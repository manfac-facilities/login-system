-- Carga única de 15/10/2026: OS que faltavam no hub (planilha do cliente, docs/cliente/2026-10-15-*)
-- Só insere. Aborta tudo se qualquer OS ou field_id já existir no hub.
begin;
create temp table carga(os text, loja text, cliente text, descricao text, fonte text, field_id text, etapa text) on commit drop;
insert into carga values
('0126-015288','DP CABO FRIO 4','DPSP','Retirada de raiz arvore fachada','field','ZjkzODU0NjAtOWJmMC00ZDJmLWJlYTUtYmI0Y2RkMDY3ZGJiOjk1NzMx','pendFat'),
('0226-009618','DP MANILHA','DPSP','Solicito reparo da porta lateral, problemas na hora de abrir e fechar.','field','Yzc0MDRlNzEtNWIzOC00YmQ1LWFiMjEtN2EyOGNmMGUzYTVmOjk1NzMx','pendFat'),
('0326-009215','DP GLORIA','DPSP','Solicito instalação de uma tomada 220:v na cozinha, pois estamos usando o microondas emprestado de outra filial na sala de treinamentos porque não tem tomada 220v na cozinha da filial.','field','ZmE2YzBkYzEtMmI1NC00YjY4LWExOTctMDExOTlmYmYyOWZlOjk1NzMx','pendFat'),
('0326-009444','DP PETROPOLIS 2','DPSP','Bom dia! Solicito troca do do tambor da porta de vidro.','field','MmZhYzVmMjgtZGQ3Ni00N2I2LWEyNDQtZmQ0NmY1NGJlZDEwOjk1NzMx','pendFat'),
('0326-010522','DP ICARAI 5','DPSP','Solicito reparo da porta principal, filial foi invadida e danificou a porta impossibilitando a abertura.','field','ZWY5ZWFmYWUtYzQ1MC00OTAyLWI0ZTYtYzg5N2UwZjEwMDU2Ojk1NzMx','pendFat'),
('0326-012374','DP CAMORIM','DPSP','Boa tarde.
Varios pontos de goteira pela loja com o gesso do teto ja danificado com risco de cair o teto novamente. Preciso de urgencia na tratativa dessa solicitacao devido a risco fisico a clientes e colaboradores.','field','M2FkNmRhNTUtNjRkZi00NTY0LWI0ZDYtMTViOWJlYmY3ZjRkOjk1NzMx','pendFat'),
('0326-012395','DP SENADOR DANTAS 2','DPSP','SOLICITO AJUDA COM FIXAÇÃO DE UM PROJETOR E TELA QUE TEMOS NO POLO SENAOR DANTAS O PROJETOR NO TETO E A TELA DE PROJEÇÃO TAMBEM NO TETO.','field','ZjcxOWY5ZmYtMTM0Mi00Y2UwLWIzNTMtODYwYzdiZDZiNDkzOjk1NzMx','pendFat'),
('0326-018781','DP SAO GONCALO 1','DPSP','Chave tambor 4 quebrada','field','ODA4ZmFlM2UtMzlhOC00MDU0LWExY2ItYzY5ZDFlZjQ1NDI1Ojk1NzMx','pendFat'),
('0426-012516','DP MACAE 2','DPSP','Mão de obra para reforma Light','field','YTRiOTUyNGUtZWRmNy00YTdhLThhNDQtNzlmZmM1NjQ2MDYyOjk1NzMx','pendFat'),
('0426-016925','DP JARDIM OCEANICO 2','DPSP','Mão de obra para troca do mobiliário do dermo.','field','YjQ2NDJhMzgtMzc2ZS00YTQxLThlOTQtMWI0NGRkYTllMmU2Ojk1NzMx','pendFat'),
('0426-016931','DP SHOPPING BARRA SHOPPING','DPSP','Mão de obra para troca do mobiliário do Dermo.','field','NDg0OTMzYmUtYjE4OS00NmIzLThiYTgtNjBhMjVmY2YwYTI0Ojk1NzMx','pendFat'),
('0426-017866','DP SAO GONCALO 1','DPSP','Cheve do tambor quebrada antes de abrir a porta','field','MjRjMzQwYWEtM2MzNC00YTAyLWIyOGMtZWMzM2NjZGIzMDc0Ojk1NzMx','pendFat'),
('0526-008051','DP SAO GONCALO 3','DPSP','Solicito conserto na porta principal de aço.
Chave quebrada na abertura de loja','field','ZmE2NzEzYTctYmY2NC00ZDEyLWFmMmItZjA1ZjkyMTNmNzZmOjk1NzMx','pendFat'),
('0526-013041','DP RIO BONITO','DPSP','Bom dia, solicito ajuda para portado meio de loja quebrada, sem conseguir abrir','field','NjZiNGVlNGItOTk2Mi00MzU3LWFjNDItNTAxMzk4NDRhOWRiOjk1NzMx','pendFat'),
('0526-013810','DP PIRATININGA','DPSP','Necessario realizar desentupimento de esgoto','field','MDA4OGM0MjUtMmM5OS00YTVhLThhOGYtYzE3MTZkNjVkZTBiOjk1NzMx','pendFat'),
('0526-016397','DP MACAE 2','DPSP','Troca do forro da marquise. ( Aditivo)','field','OThkNjg0NzUtOGY3MC00OTk2LWI5NTktZmNlNmZiYzE2MGM0Ojk1NzMx','pendFat'),
('0526-016495','DP SAO PEDRO DA ALDEIA','DPSP',null,'field','YmIzNGYyMjYtYTIxZi00MTRhLWI1MDgtODMyYTFhNTY0MGM1Ojk1NzMx','pendFat'),
('0526-017199','DP BACAXA','DPSP','BOM DIA SOLICITO SPORTE POIS A CHAVE DA PORTA DE ENTRADA ESTÁ QUEBRADA. A PORTA ESTÁ FECHADA',null,'MGNlMjM4ODYtNTMzYi00NjkxLThkNWYtM2RlNzc5YTJlOTc1Ojk1NzMx','pendFat'),
('0526-018908','DP SAO GONCALO 5','DPSP','Bom dia !Quebrou a chave da porta 3 e nao conseguimos abrir.',null,'MjU0OGE1ZmUtNTkyZi00NThmLWI0NjEtNzRiZGU5ZWZmYTZmOjk1NzMx','pendFat'),
('0526-019340','DP PADRE MIGUEL','DPSP','FIXAÇÃO DE 08 BRAÇO DE MONITOR DO CAIXA E BALCÃO DE MEDICAMENTO','field','MzU0MDEyYmYtYWVmZi00MjU4LWIwODItNTY4MTdmZDc2ZWM1Ojk1NzMx','pendFat'),
('0526-019250','DP BOTAFOGO 7','DPSP','Chave quebrada dentro do Tambor da Porta secundária.',null,'ZjhkOGVhYmUtZmNhMi00NjAxLWIwNTYtOTM0NTBmZmIyNzlhOjk1NzMx','pendFat'),
('0626-004129','DP RIO DAS OSTRAS','DPSP','Substituição de bomba de recalque','field','MmU1MDQ4OTQtZWExYi00M2RhLThmNDQtYmYxODY1ZTFiNzAyOjk1NzMx','pendFat'),
('0626-004183','DP ICARAI 2','DPSP','Solicitamos a instalação de uma nova tomada para ligar o projetor na sala de reuniões da filial.','field','NGM4YmQzYzMtYjA5Mi00NmI2LTgxZDctZGMzYWU2OWE5MDg4Ojk1NzMx','pendFat'),
('0626-004592','DP IPANEMA 1','DPSP','"Boa tarde!
Solicito a instalação de um novo ponto de tomada para a instalação da geladeira de medicamentos"','field','NDc5MzEyZjktMzdlYy00Mzg4LWJiMmEtNTNjMzQ2OTg3Y2FmOjk1NzMx','pendFat'),
('0626-005012','DP LEBLON ATAULFO 80','DPSP','"Bom dia, solicito outra portinha para nosso hidrômetro, pois o da filial foi furtado.
segue a imagem abaixo."','field','MTJiMzIyNzgtZjhjMi00NGQwLTg2ZTYtMGNjOTA2YzQ0MjcxOjk1NzMx','pendFat'),
('0626-005068','DP PADRE MIGUEL','DPSP','Caminho Cliente - Pintura fachada e benfeitorias externas','field','NGFlNzgyM2ItMTM4OC00N2U2LTliMDAtZDE3ZTcyYjIwM2I2Ojk1NzMx','pendFat'),
('0626-005488','DP BARRA DA TIJUCA 9','DPSP','Bom dia, durante a operação da porta automática, foi iniciado o fechamento sem que foss...','field','NWEwZWZhNGYtMzdjZi00Y2E0LWJlY2MtMjg1YjM1NGYxNmQwOjk1NzMx','pendFat'),
('0626-005880','DP BARRA DA TIJUCA 10','DPSP','Mão de obra para pintura da fachada.','field','ZDA4NWYzMTEtMTg2Yi00Yjc0LThhZTktN2ZjNTc0MjY4ZGYxOjk1NzMx','pendFat'),
('0626-006632','DP CATETE 3','DPSP','"Bom dia, tudo bem?

Solicito a vinda de um técnico urgentemente em loja, pois a chave quebrou dentro do tambor e não temos a cópia.




Att, Gerência."','field','MDE5MWVkYTUtM2E2Ny00MmRlLWFiY2EtZDkzN2NiZTBkNmNlOjk1NzMx','pendFat'),
('0726-009420','DP RECREIO 1','DPSP','remoção de entulho','field','MTkyYWFhZTItZDllNy00MDM5LThiNjAtMDA0NGIwNDVhZTAwOjk1NzMx','pendFat'),
('0726-010838','DP IPANEMA 1','DPSP','Instalação de 3 novas cortinas de ar.','field','OWI5ZmUwMGQtZjVlZi00OWNlLTkwZGQtYjU4YTFiMzY0OTEzOjk1NzMx','pendFat'),
('0726-011532','DP BARRA DA TIJUCA 6','DPSP','Mão de obra para pintura da fachada.','field','YTU0YWIyMzgtNTQ2My00MzRkLTk4YjEtZmJlYmNiMGZlMzBlOjk1NzMx','pendFat'),
('0726-012445','DP ROCINHA','DPSP','Transporte de longarina da BP Botafogo 6 para Rocinha.','field','MTgyM2Q3YzMtNDYxMy00OTk0LWFjODktOWZhNTYzZjg4ZWMwOjk1NzMx','pendFat'),
('0726-013344','DP IPANEMA 6','DPSP','Instalação de um novo ponte de rede para equipamento Wi-Fi.','field','ZTM1ZDI1ODUtOTAwNy00NmIxLWE5MzEtOWRjYWVkMWJiNTU0Ojk1NzMx','pendFat'),
('0726-015135','DP IPANEMA 1','DPSP','Solicito instalação caixa d''água para cozinha ou bomba pressurizadora e hidráulica;','field','ZDM3ZjFkNzEtNjgxOC00ZDE3LWFlNTgtYWU1OWI3NjZiNWE4Ojk1NzMx','pendFat'),
('0726-018016','DP ICARAI 5','DPSP','Solicito instalação de um novo ponto de tomada na voltagem 110. para a instalação de um novo refrigerador.','field','ZjI0N2IwYjMtNGFiNy00ZWEyLWI1NmQtZDI3ZmIyZmI0ZDE3Ojk1NzMx','pendFat'),
('0726-018751','DP LARGO DA BATALHA','DPSP','Solicito por favor reparo com forro ou drywall nessa parte da gerência pois está soltando essa madeira devido a uma forte chuva que teve.','field','NzRhNmYyMWEtNWVlYy00NWUyLWJiOTAtMzdlMzczZWYxNjlhOjk1NzMx','pendFat'),
('0726-009288','DP SHOPPING PLAZA MACAE','DPSP','Bom dia!
Solicito dedetização para a filial, pois foi identificado a presença de um rato no interior da loja. Acreditamos que o mesmo esta tendo acesso pelos dutos de ar condicionado do shopping, onde a filial reside.
Solicitamos urgência para evitar qualquer transtorno.
Segue anexo fotos dos locais onde acreditamos que estão tendo acesso.



Desde já, agradeço a colaboração.



Att; Gilmara Ferreira, ADM',null,'ODQ5OTJlZmMtZTdlNy00ZDhlLWI1YjktZWY3YmFkMTIxOGFkOjk1NzMx','fecharOS'),
('0826-006388','DP LEME','DPSP','Solicito bandejamento em vários pontos da área de vendas.','field','YjVjNzVhMzktOTM5Mi00NDBlLWFhMzgtOWRiM2NmMGY5ODcwOjk1NzMx','pendFat'),
('0726-019011','DP SHOPPING PLAZA MACAE','DPSP','Solicitação urgente de dedetização/desratização – Infestação de ratos
Solicitamos, com urgência, a realização de serviço de dedetização/desratização na loja.
Informamos que já foi aberta uma solicitação em 03/07 número do chamado0726-009288, porém a situação persiste e se agravou.Foram registrados incidentes de infestação de ratos, sendo que já foram capturados três roedores nas dependências da unidade. No momento, há indícios de que a infestação esteja concentrada entre o salão de vendas e a área interna da loja, representando risco à segurança sanitária, aos colaboradores, clientes e aos produtos.
Diante da recorrência do problema, solicitamos atendimento prioritário para inspeção completa do local e execução das medidas necessárias para eliminação da infestação, bem como orientações para prevenção de novos casos.
Aguardamos o agendamento do serviço com a maior brevidade possível.','field','YmMxMGQwMDktNjA5OC00NmRhLTlmMWQtOWQ5ODk4YjRhZTcwOjk1NzMx','pendFat'),
('0826-005453','DP LUCIO COSTA','DPSP','Realizar manobras hidraulicas para reestabelecer o funcionamento do sistema de agua de reuso (retirar tubo hidrometro que alimenta a cisterna de reuso e instalar valvula de retenção entre as duas caixas de agua)','field','N2YwOTE3NjgtZWNjMS00MDkxLWI5OTUtNTgzMTNjZDRjZDdiOjk1NzMx','fecharOS'),
('0826-007642','DP BUZIOS 2','DPSP','instalação de ponto de tomada para geladeira 110v.','field','YmRhOGIwOGQtMDg2Zi00YmJiLWE5N2QtYTExMTMxMTA2ZDAxOjk1NzMx','pendFat'),
('0926-011139','DP JARDIM OCEANICO 2','DPSP','"Boa Tarde!
 Solicito ajuda para o teto da gerencia que tá ficando bem úmido devida a chuva e teto danificado, essa semana a filial ficou um dia sem acesso por molhar a parte que fica a internet."','field','YWQwMzg2NTMtNTcxZi00MjlmLTg2ZjEtYWJiZjNlZTQwN2M2Ojk1NzMx','aprovarOS'),
('0826-009182','DP LEBLON 5','DPSP','bom dia, solicito instalação de novo ponto de tomada na sala de vacinas para ligar a câmara de vacinas','field','NjE5YjI1ZDUtZjg2Mi00YzM2LWExNWYtZjNmOTViYzE1ZDg0Ojk1NzMx','aprovarOS'),
('0826-007943','DP NITEROI 4','DPSP','solicito tomada para ligacao da geladeira','field','OTU0OTQxOGMtYjU4NC00MWQ2LTljYWYtN2I3NjVkM2EyNTE4Ojk1NzMx','aprovarOS'),
('0826-006948','DP PETROPOLIS 5','DPSP','solicito instalação novo ponto de tomada para geladeira','field','YzZiNTMxZmQtMzQ1YS00NGQ5LThjMDItYTA4N2I3MzY0NTAzOjk1NzMx','aprovarOS'),
('0826-011936','DP BACAXA','DPSP','bom dia solicito suporte urgente para a troca do tambor da porta de entrada, a chave quebrou dentro do tambor impossibilitando a abertura da porta','field','MDc3NjYxYTctOGRjZi00MjMzLTk1MzItMzEwNThmZmQyYjAxOjk1NzMx','pendFat'),
('0826-007936','DP BACAXA 2','DPSP','Solicito uma nova instalação de uma tomada 127 volts para a nova geladeira .','field','M2FlYWFhZTAtNTU5MS00NDJiLThlYmEtMTM3MGU5Mzg5ZTNhOjk1NzMx','pendFat'),
('0826-008257','DP PENDOTIBA','DPSP','"Solicito abertura da porta da loja, a fim de viabilizar a entrada da nova geladeira destinada ao armazenamento dos medicamentos GLP-1.
 O equipamento já foi recebido e, devido às suas dimensões, a abertura da porta é necessária para permitir a movimentação e instalação adequadas.
 A equipe de manutenção esteve na filial, mas passaram que era necessário a autorização do ggl para darem seguindo no atendimento. Com isso, segue me anexo a devida autorização. Obrigada!"',null,'NjY2ZjgwMmMtZTQzYS00MzM0LWJmZTEtNDczNjkxZGZkZmRmOjk1NzMx','definir'),
('0926-011149','DP CABO FRIO 5','DPSP','estamos com problema da agua voltando pelo ralo dea sala de serviço.','field','MTVkMTg4OTEtMDk2Yi00ZjI4LTg4MDYtNGIzNjQyZjc2MzgyOjk1NzMx','pendFat'),
('1125-010536','DP BARRA DA TIJUCA 8','DPSP','Forro soltando com o vento causando danos na estrutura da loja','field','YjkwOWQ2MTktMWMyMy00YjJiLWI0MjgtMTExMWIxMjgxNTg0Ojk1NzMx','pendFat'),
('1125-015968','DP CABO FRIO 2','DPSP','Toldo da loja se encontra enferrujado e soltando.','field','ZjE5ZmIwMWEtZTIxNS00YzZkLThkM2MtZDcyYTJhODk2OTk3Ojk1NzMx','pendFat'),
('1125-016234','DP CAMPOS 7','DPSP','Escopo Base - Adequação Elétrica para Nobreak 6kva-Itens que serão alimentados pelo quadro de emergência: 100% dos computadores da loja e dispositivos de TI (impressoras, tira teima, ponto eletrônico e servidor), geladeira de medicamento, câmeras + rack/servidor de CFTV e Parte da iluminação (definir com analista a quantidade de luminárias)-Remanejamento de circuitos para quadro de emergência com chave reversora que será alimentado pelo nobreak-Instalação de quadro bypass -Instalação e Balanceamento de cargas no quadro bypass e emergência-Verificar se as geladeiras, Kibon, Redbull estão no mesmo circuito do caixa.. caso contrário, criar um circuito independente','field','NDNjZGIwYWMtYjNmMS00ZTMzLWE5YTgtMGRkMDU3NjM2MmU4Ojk1NzMx','pendFat'),
('1125-016236','DP MACAE 3','DPSP','Escopo Base - Adequação Elétrica para Nobreak 6kva-Itens que serão alimentados pelo quadro de emergência: 100% dos computadores da loja e dispositivos de TI (impressoras, tira teima, ponto eletrônico e servidor), geladeira de medicamento, câmeras + rack/servidor de CFTV e Parte da iluminação (definir com analista a quantidade de luminárias)-Remanejamento de circuitos para quadro de emergência com chave reversora que será alimentado pelo nobreak-Instalação de quadro bypass -Instalação e Balanceamento de cargas no quadro bypass e emergência-Verificar se as geladeiras, Kibon, Redbull estão no mesmo circuito do caixa.. caso contrário, criar um circuito independente','field','MTlhZjZmOGUtNjI3ZS00ZGI2LThlYmQtZjc0ZGFhNDZkYzkxOjk1NzMx','pendFat'),
('0826-009507','DP GILKA MACHADO','DPSP','Tentativa de invasão - buraco aberto na copa',null,'MGJmMDk2YTYtZGQxNi00NmRiLWIzMTYtN2JjZjdkNDYzOTExOjk1NzMx','pendFat'),
('0926-010483','DP BOTAFOGO 10','DPSP','Solicito troca das grades de escoamento da água da chuva.','field','MDFlOGQ5OTYtYzFhOC00ZmEwLWJhY2YtYzY5ZWI5ZWM0OTlmOjk1NzMx','pendFat'),
('0726-017852','DP INGA 2','DPSP','Solicito instala ao de tomada 110v para ligar a nova geladeira.',null,'ZjRiYzRmMmUtYzJlNy00MDVlLWFmMjAtNGZlNGQ5ZGQwMzFkOjk1NzMx','fecharOS'),
('0926-010003','DP CATETE 3','DPSP','Bom dia prezados, informo que a chave do tambor quebrou dentro dele e não temos mais a cópia da chave. Solicito a troca do tambor.',null,'YTlmYjc4YjktMDk5Ni00ODEwLWJhNjUtODYwYTk5MDEzZDcwOjk1NzMx','aprovarOS'),
('0926-009636','DP ANDRADAS','DPSP','Bom dia!
A chave da porta lateral 6 quebrou. Solicito, por gentileza, ajuda para resolver essa situação, pois a loja fecha às 16h.
Agradeço desde já pela atenção e pelo suporte.','field','N2ZlNzI4N2UtNDk0NS00NTIyLTlmN2EtNzhiNjlhMTAzM2M4Ojk1NzMx','aprovarOS'),
('0826-004429','DP PETROPOLIS 6','DPSP','Mão de obra para pintura da fachada.',null,'ZWM1MTJmYmUtOWU3Mi00MGI5LWI2NmMtNDY5OTE4NmNkOWE2Ojk1NzMx','pendFat'),
('0726-009714','DSP NITEROI','DPSP','Solicito o concerto da fechadura da porta 8 lateraL,a chave quebrou dentro do tambor.',null,'NzI0Y2E4NjMtZTBhYi00ZWM5LTgxNzEtMDY3YjA2ZTdhMTA1Ojk1NzMx','fecharOS'),
('0926-015838','DP URUGUAIANA','DPSP','solicito desratização na filial com urgência encontrando muitas fezes de roedor e animais presos nas caixas de passagem',null,'MzZjOTNmOTYtNTNhNi00YmNmLWJmYWUtMjlkYzIxM2ZjMDljOjk1NzMx','aprovarOS'),
('1026-006815','DP LEBLON 3','DPSP','Solicito manutenção da porta de vitrine , não estamos conseguindo fechar a loja.

Perda das chaves.',null,'MjI3MDM3MzUtZDNhZC00MDFmLThlYTQtYWNmMjAxZTAyMjIyOjk1NzMx','aprovarOS'),
('1026-005832','DP MARICA 1','DPSP','Boa noite. Filial sem água.',null,'ZTZjZWNkZGYtZDdkYS00OWZjLWI1MzItNzkwZmUzMzg1YzE5Ojk1NzMx','aprovarOS'),
('1026-005925','DSP NITEROI','DPSP','Bom dia
A chave da porta lateral do n°7 quebrou
favor solicito a troca do tambor para a mesma

hoje a loja só funciona até as 19:00',null,'ZTZmNmQ1MGItNGYwMS00YzBlLWI3NTAtNzYxODQ0ZWU3NzkwOjk1NzMx','aprovarOS');
do $$ begin
  if exists (select 1 from obras_obra o join carga c on o.os = c.os or o.field_id = c.field_id) then
    raise exception 'carga abortada: OS ou field_id já existe no hub';
  end if;
end $$;
with novas as (
  insert into obras_obra (os, loja, cliente, descricao, fonte, field_id, etapa)
  select os, loja, cliente, descricao, fonte, field_id, etapa from carga
  returning id, etapa
)
insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
select id, 'Esteira', 'etapa', null, etapa, 'Carga de 15/10/2026: OS que faltava no hub, etapa informada pelo cliente', 'carga-15-10 (Claude, a pedido do João)' from novas;
select count(*) as inseridas from obras_obra where field_id in (select field_id from carga);
commit;
