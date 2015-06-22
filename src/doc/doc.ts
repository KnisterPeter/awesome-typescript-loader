import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';

import SyntaxKind = ts.SyntaxKind;
import TypeChecker = ts.TypeChecker;
import SourceFile = ts.SourceFile;
import Node = ts.Node;
import Type = ts.Type;
import Symbol = ts.Symbol;

let tsInst: typeof ts = require('typescript');
let CircularJSON = require('circular-json');

let fse = require('fs-extra');
let closest = require('closest-package');

interface IPackage {
    info: any;
    path: string;
}

export function extractPackage(fileName: string): IPackage {
    let pkgJson = closest.sync(path.dirname(fileName));
    return {
        path: path.dirname(pkgJson),
        info: JSON.parse(fs.readFileSync(pkgJson).toString())
    }
}

export function getDocDirForPackage(pkg: IPackage) {
    return path.join(
        process.cwd(),
        'docs',
        pkg.info.name
    )
}

interface IDocFile {
    absoluteOrigin: string;
    absoluteMeta: string;
    relativeOrigin: string;
}

export function getDocFilePath(fileName: string, pkg: IPackage): IDocFile {
    let relativeOrigin = path.relative(pkg.path, fileName);
    let absoluteOrigin = path.join(getDocDirForPackage(pkg), relativeOrigin);
    let absoluteMeta = `${absoluteOrigin}.json`;

    return {
        absoluteMeta,
        absoluteOrigin,
        relativeOrigin
    }
}


class DocMeta {
    private sourceFile: SourceFile;
    private pkg: string;
    private relativePath: string;
    private types: Type[] = [];

    constructor(sourceFile: SourceFile, pkg: string, relativePath: string) {
        this.sourceFile = sourceFile;
        this.pkg = pkg;
        this.relativePath = relativePath;
    }

    addType(type: Type) {
        this.types.push(type);
    }

    toJSON() {
        return {
            pkg: this.pkg,
            relativePath: this.relativePath,
            sourceFile: this.sourceFile,
            types: this.types
        }
    }
}

interface VisitContext {
    typeChecker: TypeChecker;
    tsInst: typeof ts;
    meta: DocMeta
}

export function processSourceFile(source: SourceFile, ctx: VisitContext) {
    function visitNode(node: Node) {
        switch (node.kind) {
            case SyntaxKind.InterfaceDeclaration:
                visitInterface(node, ctx)
        }
        ctx.tsInst.forEachChild(node, visitNode);
    }
    visitNode(source);
}

export function visitInterface(node: Node, ctx: VisitContext) {
    ctx.meta.addType(ctx.typeChecker.getTypeAtLocation(node))
}

export function generateDoc(fileName: string, source: SourceFile, program: ts.Program, tsInst: typeof ts) {
    let pkg = extractPackage(fileName);
    let docFilePath = getDocFilePath(fileName, pkg);
    fse.ensureDirSync(path.dirname(docFilePath.absoluteOrigin));

    let typeChecker = program.getTypeChecker();
    let meta = new DocMeta(source, pkg.info.name, docFilePath.relativeOrigin);

    processSourceFile(source, { typeChecker, tsInst, meta });
    fs.writeFileSync(docFilePath.absoluteMeta, CircularJSON.stringify(meta, null, 4));
}
