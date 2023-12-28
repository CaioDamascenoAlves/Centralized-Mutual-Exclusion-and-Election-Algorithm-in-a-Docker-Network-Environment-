#!/bin/bash

# Verificar se as chaves SSH já existem
if [ ! -f ~/.ssh/id_rsa ]; then
    mkdir -p ~/.ssh
    ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa
fi

# Verificar se o arquivo .env existe
if [ ! -f /app/api/.env ]; then
    touch /app/api/.env
fi

# Obter a chave pública atual
CURRENT_PUBLIC_KEY=$(cat ~/.ssh/id_rsa.pub)

# Obter a chave pública no arquivo .env, se existir
SAVED_PUBLIC_KEY=$(grep '^SSH_PUBLIC_KEY=' /app/api/.env | sed 's/^SSH_PUBLIC_KEY=//')

# Verificar se a chave pública no .env é a mesma da chave no sistema
if [ "$CURRENT_PUBLIC_KEY" != "$SAVED_PUBLIC_KEY" ]; then
    # Remover o arquivo .env existente
    rm /app/api/.env

    # Criar um novo arquivo .env com a chave pública atual
    echo "SSH_PUBLIC_KEY=$CURRENT_PUBLIC_KEY" >> /app/api/.env
fi

echo "Configuração de SSH e .env concluída."

# Executar qualquer outro comando necessário aqui

