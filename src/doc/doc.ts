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
let refify = require('refify');

let fse = require('fs-extra');
let closest = require('closest-package');

export interface DocMap {
    [key: string]: Doc
}

export class DocRegistry {
    docs: DocMap = {}

    addDoc(fileName, doc: Doc) {
        this.docs[fileName] = doc;
    }

    writeDocs() {
        _.forEach(this.docs, (doc) => {
            fs.writeFileSync(doc.fileInfo.absoluteMeta, refify.stringify(doc, (key, value) => {
                if (key == 'parent') {
                    return undefined
                } else {
                    return value
                }
            }, 4));
        });
    }

    generateRegistryModule(): string {
        var buf = 'module.exports = {\n';

        _.forEach(this.docs, (doc) => {
            buf += `    '${doc.fileInfo.relativeOrigin}': require('./${path.relative('docs', doc.fileInfo.absoluteMeta)}'),\n`
        });

        buf += '}';

        return buf;
    }


    writeRegistryModule() {
        let registryModule = this.generateRegistryModule();
        fs.writeFileSync('./docs/registry.js', registryModule);
    }

}

export interface IDocFile {
    absoluteOrigin: string;
    absoluteMeta: string;
    relativeOrigin: string;
    relativeMeta: string;
}

export interface IPackage {
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

export function getDocFilePath(fileName: string, pkg: IPackage): IDocFile {
    let relativeOrigin = path.relative(pkg.path, fileName);
    let absoluteOrigin = path.join(getDocDirForPackage(pkg), relativeOrigin);
    let absoluteMeta = `${absoluteOrigin}.docscript.json`;
    let relativeMeta = path.relative(pkg.path, absoluteMeta);

    return {
        absoluteMeta,
        relativeMeta,
        absoluteOrigin,
        relativeOrigin,
    }
}


class Doc {
    sourceFile: SourceFile;
    pkg: string;
    fileInfo: IDocFile;
    types: Type[] = [];

    constructor(sourceFile: SourceFile, pkg: string, fileInfo: IDocFile) {
        this.sourceFile = sourceFile;
        this.pkg = pkg;
        this.fileInfo = fileInfo;
    }

    addType(type: Type) {
        this.types.push(type);
    }

    toJSON() {
        return {
            pkg: this.pkg,
            relativePath: this.fileInfo.relativeOrigin,
            //sourceFile: this.sourceFile,
            types: this.types
        }
    }
}

interface VisitContext {
    typeChecker: TypeChecker;
    tsInst: typeof ts;
    doc: Doc
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
    ctx.doc.addType(ctx.typeChecker.getTypeAtLocation(node))
}

export function generateDoc(fileName: string, source: SourceFile, program: ts.Program, tsInst: typeof ts): Doc {
    let pkg = extractPackage(fileName);
    let docFilePath = getDocFilePath(fileName, pkg);
    fse.ensureDirSync(path.dirname(docFilePath.absoluteOrigin));

    let typeChecker = program.getTypeChecker();
    let doc = new Doc(source, pkg.info.name, docFilePath);

    processSourceFile(source, { typeChecker, tsInst, doc });
    return doc;
}
