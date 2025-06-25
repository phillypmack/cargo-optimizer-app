// add-js-imports.js
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

// Diretório principal a ser verificado (geralmente 'src')
const TARGET_DIR = './src';

// Extensões de arquivo que o script deve processar
const VALID_EXTENSIONS = ['.ts', '.tsx'];

// Regex para encontrar importações/exportações relativas (que começam com ./ ou ../)
// e que não possuem uma extensão de arquivo no final.
// Ex: from './component' (corresponde)
// Ex: from './component.js' (ignora)
// Ex: from 'react' (ignora)
const IMPORT_REGEX = /(import|export)(.*from\s+['"])(\.\.?\/[^"']*)(?<!\.\w{2,4})(['"])/g;

let filesModified = 0;

async function processDirectory(directory) {
    try {
        const files = await readdir(directory, { withFileTypes: true });

        for (const file of files) {
            const fullPath = join(directory, file.name);

            if (file.isDirectory()) {
                // Se for um diretório, entra nele recursivamente
                await processDirectory(fullPath);
            } else if (VALID_EXTENSIONS.includes(extname(file.name))) {
                // Se for um arquivo TypeScript/TSX, processa-o
                await processFile(fullPath);
            }
        }
    } catch (error) {
        console.error(`Erro ao ler o diretório ${directory}:`, error);
    }
}

async function processFile(filePath) {
    try {
        const originalContent = await readFile(filePath, 'utf-8');
        let contentChanged = false;

        const newContent = originalContent.replace(IMPORT_REGEX, (match, start, mid, path, end) => {
            contentChanged = true;
            // Remonta a declaração adicionando .js ao final do caminho
            return `${start}${mid}${path}.js${end}`;
        }
        );

        if (contentChanged) {
            filesModified++;
            await writeFile(filePath, newContent, 'utf-8');
            console.log(`[MODIFICADO] ==> ${filePath}`);
        }
    } catch (error) {
        console.error(`Falha ao processar o arquivo ${filePath}:`, error);
    }
}

(async () => {
    console.log('Iniciando script para adicionar extensão .js nas importações...');
    console.log(`Diretório alvo: ${TARGET_DIR}\n`);

    await processDirectory(TARGET_DIR);

    console.log('\n--------------------------------------------------');
    if (filesModified > 0) {
        console.log(`✅ Sucesso! O script foi concluído. ${filesModified} arquivo(s) modificado(s).`);
        console.log('Tente executar "npm run dev" novamente.');
    } else {
        console.log('✅ O script foi concluído. Nenhum arquivo precisou ser modificado.');
    }
    console.log('--------------------------------------------------');
})();