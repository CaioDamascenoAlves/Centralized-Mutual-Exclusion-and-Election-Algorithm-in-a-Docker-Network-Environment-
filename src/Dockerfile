# Use a imagem oficial do Ubuntu como base
FROM ubuntu:latest

# Atualize os repositórios e instale as ferramentas necessárias
RUN apt-get update && apt-get install -y \
    curl \
    software-properties-common \
    iproute2 \
    net-tools \
    iputils-ping \
    systemd \
    nano \
    openssh-server

# Adicione o repositório do Node.js e instale o Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Defina o diretório de trabalho para /app
WORKDIR /app

# Copie os arquivos de definição de pacote do Node.js e instale as dependências
COPY package.json package-lock.json ./
RUN npm install

# Copie o restante dos arquivos do projeto para o diretório /app/api
COPY server ./server

# Exponha as portas para a API, consumidores, eleição e SSH
EXPOSE 3000 4000 22

# Iniciar o serviço OpenSSH
RUN service ssh start

# Comando para manter o contêiner rodando sem executar um processo
CMD ["node", "server/main.js"]
