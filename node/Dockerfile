# Usando a imagem oficial do Ubuntu
FROM ubuntu:latest

# Instalar curl , software-properties-common (para adicionar repositórios) e comandos de rede
RUN apt-get update && apt-get install -y curl software-properties-common iproute2 net-tools iputils-ping systemd nano

# Adicionar o repositório do Node.js e instalar o Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Definir como diretório de trabalho
WORKDIR /app

# Copiar os arquivos de definição de pacote do Node.js e instalar as dependências
COPY package.json package-lock.json ./
RUN npm install

# Copiar o restante dos arquivos do projeto para o diretório do app
COPY api ./api

# Expor as portas para a API, consumidores e eleição
EXPOSE 3000 3001 3002

# Comando para manter o contêiner rodando sem executar um processo
CMD ["tail", "-f", "/dev/null"]
