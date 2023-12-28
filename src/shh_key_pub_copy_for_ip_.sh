#!/bin/bash

# Nome da rede Docker Compose
NETWORK_NAME="app_network"

# Obter o nome do host do contêiner em execução
SOURCE_CONTAINER=$(cat /etc/hostname)

# Listar todos os contêineres na rede, exceto o contêiner de origem
CONTAINERS=$(docker ps --format "{{.Names}}" --filter "network=$NETWORK_NAME" | grep -v "$SOURCE_CONTAINER")

# Caminho da chave SSH pública no contêiner de origem
SSH_KEY_PATH="/root/.ssh/id_rsa.pub"

# Copiar a chave SSH para os outros contêineres
for CONTAINER in $CONTAINERS
do
  echo "Copiando chave SSH para o contêiner $CONTAINER"
  docker cp $SSH_KEY_PATH $CONTAINER:/root/.ssh/authorized_keys
done

echo "Chave SSH copiada para todos os contêineres na rede."
