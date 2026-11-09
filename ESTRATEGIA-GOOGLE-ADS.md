# Site + Google Ads: estratégia e guia de implantação

Psicóloga Bianca Gonçalves · CRP 04/55402 · documento de novembro de 2026

Objetivo único da página: **levar a visitante vinda do anúncio a iniciar uma conversa no WhatsApp.**

---

## 1. Diagnóstico do site antigo

O site antigo está preservado em `versao-antiga/index.html` (não indexado) e na tag git `v1-site-antigo`.

| Problema | Impacto no Ads |
|---|---|
| Hero do mobile cobria o rosto com texto, e o botão de WhatsApp do header sumia no mobile | Menos cliques justamente onde está a maior parte do tráfego |
| Foto de 11 MB, vídeo de 60 MB carregando com a página, Font Awesome inteira | Página lenta, Índice de Qualidade menor e CPC mais caro |
| **Depoimentos de pacientes** (um deles cita "Dra. Bianca") | A Nota Técnica CFP 1/2022 desaconselha e restringe o uso. "Dra." só cabe para quem tem doutorado (art. 20 do Código de Ética) |
| Textos no imperativo ("Supere", "Rompa", "Comece sua transformação") | Podem ser lidos como promessa de resultado (art. 20, alínea "e") |
| Nenhuma medição de conversão, sem política de privacidade, sem aviso de cookies | Sem dados para otimizar. O Google exige política de privacidade na página de destino |
| Mesmo título para qualquer busca | Pouca coerência entre anúncio e página |
| Seção do Instagram no meio da página | Leva a visitante para fora antes da conversão |

## 2. O que o novo site faz

**Estrutura pensada para conversão**:
1. Hero
2. "Talvez você se reconheça" (identificação)
3. Temas
4. Sobre
5. Vídeo
6. Como funciona (3 passos)
7. Abordagem
8. Terapia online
9. FAQ de objeções
10. CTA final

**Conversão e coerência com o anúncio:**
- **Um único objetivo:** todos os 9 botões levam ao WhatsApp, com a mensagem já preenchida ("Olá, Bianca! Vim pelo site...").
- **CTA fixo no mobile:** aparece depois do hero e some no final da página.
- **Título dinâmico por grupo de anúncios** (`?tema=`): ver a seção 4.
- **Rastreamento:** registra qual botão foi clicado (`data-cta`: header, hero, sobre, como-funciona, faq, final, footer, sticky-mobile).

**Credibilidade e regras do CFP:**
- Nome e CRP aparecem no topo, no "Sobre" e no rodapé.
- Sem depoimentos, sem preço e sem "Dra.".
- Os textos descrevem objetivos possíveis, sem prometer resultado.
- Aviso de emergência no rodapé (CVV 188 / SAMU 192).

**Desempenho (Lighthouse, mobile):**
- Performance 94, Acessibilidade 100, Boas práticas 100, SEO 100.
- Em produção, o `nginx.conf` ativa gzip e cache, o que deve subir ainda mais a nota de performance.
- O que mudou: imagens em WebP (de 11 MB para cerca de 100 KB), vídeo comprimido (de 60 MB para 4,6 MB) que só carrega no clique, e fontes hospedadas no próprio site.

**Privacidade (LGPD):**
- Banner de cookies com Aceitar/Recusar, ligado ao Consent Mode v2.
- O padrão é "negado", com `url_passthrough` ativo.
- A personalização de anúncios fica **sempre desativada**, porque saúde mental é categoria sensível.

## 3. Medição: passo a passo (obrigatório antes de ligar a campanha)

1. No Google Ads, vá em **Metas > Conversões > Nova ação de conversão > Site > configurar manualmente**.
   - Categoria: **Contato** · Nome: `Clique WhatsApp` · Valor: não usar · Contagem: **Uma** · Janela: 30 dias.
2. Copie o **ID de conversão** (`AW-XXXXXXXXX`) e o **rótulo** (`AbCdEf...`).
3. No `index.html`, preencha o bloco `SITE_CONFIG` (perto do topo):
   ```js
   adsId: "AW-XXXXXXXXX",
   adsConversion: "AbCdEf...",
   ga4Id: "G-XXXXXXX"   // opcional
   ```
4. Publique e teste com o **Google Tag Assistant**: clique em um botão de WhatsApp e confirme o disparo da conversão.
5. Em **Configurações da campanha**, deixe **desativados** o remarketing, as listas de clientes (Customer Match) e os públicos semelhantes. Saúde mental é categoria sensível, e usar esses recursos leva à reprovação.

**Limitação a conhecer:** o clique não garante que a mensagem foi enviada.
- Toda semana, compare as conversões do Ads com as conversas que realmente chegaram.
- Mais adiante, dá para importar os agendamentos reais como conversão offline.

## 4. Estrutura da campanha

**Campanha:**

| Item | Configuração |
|---|---|
| Tipo | Rede de Pesquisa (sem Display e sem parceiros de pesquisa no início) |
| Local | Brasil · Idioma: português |
| Lance | Começar em **Maximizar cliques** com CPC máximo de cerca de R$ 5. Depois de ~30 conversões, mudar para **Maximizar conversões** |
| Orçamento inicial sugerido | R$ 30 a R$ 50 por dia, por 3 a 4 semanas de aprendizado |
| Público | Ajuste de lance por gênero/idade (mulheres, 18 a 44). Não excluir "desconhecido" no começo |

**Grupos de anúncios.** Cada grupo usa um **sufixo de URL final** diferente, e a página adapta o título a ele:

| Grupo | Sufixo do URL final | Título que a visitante vê |
|---|---|---|
| Psicóloga online | `tema=online` | Psicóloga online para mulheres, onde você estiver. |
| Ansiedade | `tema=ansiedade` | Terapia online para ansiedade, no seu ritmo. |
| Autoestima | `tema=autoestima` | Terapia online para cuidar da sua autoestima. |
| Relacionamentos | `tema=relacionamentos` | Terapia para entender seus padrões nos relacionamentos. |
| Dependência emocional / medo de ficar só | `tema=dependencia` | Terapia para quem tem medo de ficar sozinha. |
| Limites | `tema=limites` | Terapia para aprender a dizer não sem culpa. |
| Terapia do Esquema | `tema=esquema` | Terapia do Esquema online, com acolhimento. |

Um valor de `tema` desconhecido mostra o título padrão. O card do tema correspondente ganha destaque na seção "Como posso ajudar".

**Palavras-chave (frase e exata):**
- **Online:** "psicóloga online", [psicóloga online], "terapia online", "consulta psicológica online", "psicóloga online mulher"
- **Ansiedade:** "terapia para ansiedade", "psicóloga para ansiedade", [terapia online ansiedade]
- **Autoestima:** "terapia autoestima", "psicóloga autoestima", "terapia para mulheres", "psicóloga para mulheres"
- **Relacionamentos:** "terapia relacionamento tóxico", "psicóloga relacionamento abusivo", "terapia para relacionamento"
- **Dependência:** "dependência emocional terapia", "psicóloga dependência emocional", "medo de ficar sozinha terapia"
- **Limites:** "terapia para colocar limites", "dificuldade de dizer não terapia"
- **Esquema:** "terapia do esquema", [terapia do esquema online], "psicóloga terapia do esquema", "psicóloga TCC online"

**Negativas (lista da conta):**
- grátis, gratuito, gratuita
- SUS, CAPS, convênio, plano de saúde, unimed
- curso, faculdade, graduação, pós, especialização, formação, livro, pdf, apostila, artigo, monografia
- estágio, vaga, vagas, emprego, salário, concurso, "como ser psicóloga"
- o que é, significado, sintomas, teste, quiz, frases
- psiquiatra, remédio, medicamento, cid
- infantil, criança, adolescente, casal, presencial

Revise o **relatório de termos de pesquisa toda semana** nas primeiras 4 semanas.

**Anúncio responsivo: títulos (até 30 caracteres, todos conferidos):**
- Psicóloga Online p/ Mulheres
- Terapia Online com TCC
- Terapia do Esquema Online
- Psicóloga CRP 04/55402
- Converse pelo WhatsApp
- Sessões por Videochamada
- Atendimento em Todo o Brasil
- Um Espaço Seguro para Você
- Psicóloga Bianca Gonçalves
- Sessões Semanais de 50 min
- Terapia Online e Sigilosa
- *Por grupo:* Terapia Online p/ Ansiedade · Terapia Online p/ Autoestima · Terapia p/ Relacionamentos · Aprenda a Dizer Não Sem Culpa

**Descrições (até 90 caracteres):**
- Psicoterapia online para mulheres com TCC e Terapia do Esquema. Converse pelo WhatsApp.
- Um espaço seguro e sem julgamentos para cuidar de você, de onde estiver. CRP 04/55402.
- Autoestima, relacionamentos, limites e ansiedade. Sessões por videochamada, com sigilo.
- Tire suas dúvidas sobre valores e horários pelo WhatsApp. Atendimento para todo o Brasil.
- *Ansiedade:* Entenda o que alimenta sua ansiedade com TCC. Terapia online para mulheres. CRP 04/55402.
- *Relacionamentos:* Olhe para os padrões que se repetem no amor com Terapia do Esquema. Atendimento online.

**O que evitar nos anúncios:**
- Frases que sugerem conhecer a condição da pessoa ("Você tem ansiedade?", "Sofre num relacionamento tóxico?"). A política de saúde do Google reprova.
- Inserção dinâmica de palavra-chave.
- Promessas ("Supere de vez") e urgência ("Últimas vagas").

**Extensões (recursos):**
- Sitelinks: Como funciona (`#como-funciona`), Sobre mim (`#sobre`), Dúvidas (`#duvidas`), Terapia do Esquema (`?tema=esquema`)
- Frases de destaque: 100% online · Sigilo profissional · Sessões de 50 min · TCC e Terapia do Esquema
- Extensão de chamada/mensagem: opcional

## 5. Rotina de otimização

- **Semana 1–2:** negativar termos irrelevantes e conferir se as conversões estão sendo registradas.
- **Semana 3–4:** pausar palavras-chave com custo alto e sem conversão. Concentrar orçamento nos grupos com menor custo por conversa.
- **Mês 2:** mudar o lance para Maximizar conversões. Testar novos títulos no grupo com mais volume.
- **Métricas para acompanhar:**
  - CTR (meta acima de 4%)
  - taxa de clique no WhatsApp por visita (meta de 5 a 12%)
  - custo por conversa iniciada
  - **custo por paciente agendada**, que é o número que realmente importa

## 6. Pendências para confirmar

- [ ] **Domínio:** usei `https://psibiancagoncalves.com.br/` nas tags canonical/OG, no sitemap e no robots. Ajuste se o domínio for outro.
- [ ] **IDs do Google Ads / GA4** em `SITE_CONFIG` (seção 3).
- [ ] **FAQ "Emito recibo… reembolso":** confirme se a Bianca emite recibo. Se não emitir, ajuste o texto.
- [ ] **"Eu respondo pessoalmente"** (seção Como funciona): confirme se é a própria Bianca quem responde o WhatsApp.
- [ ] **Depoimentos:** foram removidos por segurança ética. Se quiser usá-los, só com consentimento por escrito de cada paciente, e ainda assim o CRP os considera "não recomendados". Vale consultar o CRP-04.
- [ ] (Opcional) Gravar o vídeo de apresentação em formato vertical (9:16), com legenda. Ele funciona melhor no mobile e pode virar anúncio de vídeo no YouTube.
