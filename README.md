Estados dos Processos:
Eleição: Inicialmente, todos os processos iniciarão no estado de eleição. Eles tentarão se tornar o coordenador.
Coordenador: O processo eleito como coordenador gerenciará as solicitações de acesso ao recurso.
Consumidor: Processos que não são coordenadores agirão como consumidores, solicitando acesso ao recurso.
Passo a Passo da Implementação:
1. Estado de Eleição:
Implementar um mecanismo de eleição com base no algoritmo de anel, usando as variáveis de ambiente ELECTION_ID, ELECTION_DEST_IPS, ELECTION_DEST_PORT e SUCCESSOR_IP.
Iniciar temporizadores de eleição aleatórios para cada processo, que determinarão quando um processo deve iniciar uma nova eleição.
Quando um temporizador de eleição expirar, o processo atual iniciará uma eleição:
Montar uma mensagem de eleição com seu próprio número de processo (HOSTID) e enviar ao sucessor especificado em SUCCESSOR_IP na porta ELECTION_DEST_PORT.
A mensagem deve conter a lista de processos em funcionamento ao longo do caminho.
O processo eleito deve aguardar respostas dos outros processos de eleição e determinar o novo coordenador com base no maior número de processo.
Enviar uma mensagem COORDENADOR com o novo coordenador e a lista de processos em funcionamento.
2. Estado de Coordenador:
O processo eleito como coordenador gerenciará as solicitações de acesso ao recurso.
Implementar um serviço ou endpoint para receber solicitações dos consumidores.
Gerenciar a fila de solicitações usando o algoritmo FIFO.
Coordenar a autorização ou negação de acesso com base na FIFO.
Manter uma lista de processos em funcionamento e responder a mensagens de eleição.
3. Estado de Consumidor:
Processos no estado de consumidor devem:
Enviar solicitações de acesso ao coordenador.
Aguardar a autorização ou negação do acesso por parte do coordenador.
Em caso de negação ou falta de resposta, iniciar uma nova eleição.
Manter a lista de processos em funcionamento e responder a mensagens de eleição.
Componentes e Endpoints:
Cada processo deve ter componentes para gerenciar o estado de eleição, coordenador e consumidor, além de manter informações sobre o líder atual, a fila de solicitações e outros processos em funcionamento.
Implementar os endpoints necessários para cada estado, como endpoints de solicitação e resposta de eleição, solicitação e resposta de acesso, entre outros.
Este é um plano geral para implementar a arquitetura proposta.