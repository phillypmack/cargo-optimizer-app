const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd(); // Onde o script está sendo executado, idealmente a raiz do seu novo backend

const structure = {
    'src': {
        'app.ts': '// Configuração principal do Express e middlewares\n',
        'server.ts': '// Ponto de entrada da aplicação (inicia o servidor)\n',
        'config': {
            'index.ts': '// Carrega variáveis de ambiente e configurações gerais\n',
            'database.ts': '// Configurações de conexão com o banco de dados\n',
        },
        'controllers': {
            'authController.ts': '// Lógica para autenticação\n',
            'itemController.ts': '// Lógica para gerenciamento de itens\n',
            'simulationController.ts': '// Lógica para simulações\n',
            'adminController.ts': '// Lógica para o painel administrativo\n',
        },
        'middleware': {
            'authMiddleware.ts': '// Funções para autenticação e autorização\n',
            'validationMiddleware.ts': '// Funções para validação de dados\n',
        },
        'models': {
            'User.ts': '// Definição do esquema de usuário (Mongoose/Sequelize)\n',
            'Item.ts': '// Definição do esquema de item\n',
            'Simulation.ts': '// Definição do esquema de simulação\n',
        },
        'routes': {
            'authRoutes.ts': '// Rotas para autenticação\n',
            'itemRoutes.ts': '// Rotas para itens\n',
            'simulationRoutes.ts': '// Rotas para simulações\n',
            'adminRoutes.ts': '// Rotas para o painel administrativo\n',
        },
        'services': {
            'authService.ts': '// Lógica de negócio para autenticação\n',
            'itemService.ts': '// Lógica de negócio para itens\n',
            'simulationService.ts': '// Lógica de negócio para simulações\n',
            'packingService.ts': '// Lógica de empacotamento (FFD/BFD)\n',
            'geminiService.ts': '// Interação com a API Gemini\n',
        },
        'utils': {
            'errorHandler.ts': '// Funções para tratamento de erros\n',
        }
    },
    '.env': '# Variáveis de ambiente (ex: GEMINI_API_KEY=your_key_here)\n',
    '.env.example': '# Exemplo de variáveis de ambiente\nGEMINI_API_KEY=\nDATABASE_URL=\nJWT_SECRET=\n',
    '.gitignore': 'node_modules/\ndist/\n.env\n',
    'package.json': JSON.stringify({
        name: "cargo-optimizer-backend",
        version: "1.0.0",
        description: "Backend for 3D Cargo Optimizer",
        main: "dist/server.js",
        scripts: {
            "start": "node dist/server.js",
            "dev": "nodemon --exec ts-node src/server.ts",
            "build": "tsc",
            "test": "echo \"Error: no test specified\" && exit 1"
        },
        keywords: [],
        author: "",
        license: "ISC",
        dependencies: {
            "@google/generative-ai": "^0.7.0",
            "bcryptjs": "^2.4.3",
            "dotenv": "^16.4.5",
            "express": "^4.19.2",
            "jsonwebtoken": "^9.0.2",
            "mongoose": "^8.4.1"
        },
        devDependencies: {
            "@types/bcryptjs": "^2.4.6",
            "@types/express": "^4.17.21",
            "@types/jsonwebtoken": "^9.0.6",
            "@types/mongoose": "^5.11.97",
            "@types/node": "^20.14.0",
            "nodemon": "^3.1.3",
            "ts-node": "^10.9.2",
            "typescript": "^5.4.5"
        }
    }, null, 2),
    'tsconfig.json': JSON.stringify({
        "compilerOptions": {
            "target": "ES2020",
            "module": "CommonJS",
            "rootDir": "./src",
            "outDir": "./dist",
            "esModuleInterop": true,
            "forceConsistentCasingInFileNames": true,
            "strict": true,
            "skipLibCheck": true
        },
        "include": ["src/**/*.ts"],
        "exclude": ["node_modules"]
    }, null, 2),
    'README.md': '# 3D Cargo Optimizer Backend\n\nEste é o backend para a aplicação 3D Cargo Optimizer.\n\n## Configuração\n\n1.  **Instale as dependências:**\n    ```bash\n    npm install\n    ```\n\n2.  **Crie um arquivo `.env`:**\n    Copie o conteúdo de `.env.example` para um novo arquivo chamado `.env` e preencha suas variáveis de ambiente.\n\n3.  **Execute em modo de desenvolvimento:**\n    ```bash\n    npm run dev\n    ```\n\n4.  **Construa para produção:**\n    ```bash\n    npm run build\n    npm start\n    ```\n'
};

function createStructure(basePath, currentStructure) {
    for (const key in currentStructure) {
        const currentPath = path.join(basePath, key);
        if (typeof currentStructure[key] === 'object' && !Array.isArray(currentStructure[key])) {
            // É uma pasta
            if (!fs.existsSync(currentPath)) {
                fs.mkdirSync(currentPath, { recursive: true });
                console.log(`Pasta criada: ${currentPath}`);
            }
            createStructure(currentPath, currentStructure[key]); // Chama recursivamente
        } else {
            // É um arquivo
            if (!fs.existsSync(currentPath)) {
                fs.writeFileSync(currentPath, currentStructure[key]);
                console.log(`Arquivo criado: ${currentPath}`);
            } else {
                console.log(`Arquivo já existe, ignorado: ${currentPath}`);
            }
        }
    }
}

console.log('Iniciando a criação da estrutura do backend...');
createStructure(projectRoot, structure);
console.log('Estrutura do backend criada com sucesso!');

// Opcional: Instalar dependências automaticamente (descomentar se desejar)
// console.log('Instalando dependências (isso pode levar alguns minutos)...');
// const { execSync } = require('child_process');
// try {
//     execSync('npm install', { stdio: 'inherit', cwd: projectRoot });
//     console.log('Dependências instaladas com sucesso!');
// } catch (error) {
//     console.error('Erro ao instalar dependências:', error.message);
// }