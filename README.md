Descrição do Sistema
Este sistema é uma implementação de um sistema distribuído que utiliza um algoritmo de eleição por anel para escolher dinamicamente um coordenador entre vários nós. Cada nó pode atuar tanto como produtor quanto como coordenador, dependendo do estado atual do sistema e do resultado do processo de eleição.

Componentes do Sistema
Server (Servidor): Responsável por gerenciar as conexões de rede, como aceitar novos nós e enviar mensagens multicast.

Node (Nó): Cada nó representa uma entidade no sistema que pode ser um produtor de dados ou um coordenador. Cada nó mantém informações sobre seu estado, ID, informações de rede, etc.

State and Subclasses (Estado e Subclasses): Representam os diferentes estados em que um nó pode estar. Inclui estados como CoordinatorState (Estado do Coordenador) e ProducerState (Estado do Produtor).

Fluxo do Algoritmo de Eleição por Anel
O algoritmo de eleição por anel é uma parte crucial deste sistema, sendo ativado sob condições específicas, como a falha de um coordenador. Aqui está o fluxo detalhado:

Detecção de Falha do Coordenador: Quando um nó percebe que o coordenador atual falhou ou está inacessível, ele inicia o processo de eleição.

Início da Eleição: O nó que detecta a falha começa a eleição enviando uma mensagem de eleição para o próximo nó no anel.

Propagação da Mensagem: A mensagem de eleição circula pelo anel. Cada nó, ao receber a mensagem, adiciona seu ID a ela e a passa para o próximo nó.

Determinação do Coordenador: Quando a mensagem de eleição completa o círculo e retorna ao nó que iniciou a eleição, este nó analisa os IDs coletados na mensagem. O nó com o maior ID é eleito como o novo coordenador.

Estabelecimento do Novo Coordenador: O nó eleito assume o papel de coordenador e começa a gerenciar as solicitações de acesso e outras tarefas coordenativas.

Estados dos Nós
CoordinatorState: Quando um nó está neste estado, ele atua como coordenador, gerenciando as solicitações de acesso e outras responsabilidades administrativas.

ProducerState: Neste estado, um nó atua como produtor, possivelmente enviando solicitações de acesso ao coordenador e participando do processo de eleição se necessário.

Este sistema, portanto, garante uma gestão flexível e dinâmica de coordenadores em um ambiente distribuído, permitindo uma recuperação eficiente e uma gestão robusta de falhas.
