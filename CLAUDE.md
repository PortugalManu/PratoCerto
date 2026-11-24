# Prato Certo

App do celular (PWA) publicado no GitHub Pages: diário alimentar que conta **porções por grupo** da lista de substituição da nutricionista. Sem build: HTML, CSS e JS puros (ES modules).

- `index.html`, `styles.css`, `app.js`: telas e regras do app.
- `alimentos.js`: reconhece o que a pessoa escreve ("30g de arroz", "2 ovos", "macarrão com carne tudo 140g") e converte em porções. `PREF` liga palavras do dia a dia a itens da lista e tem os macros TACO por 100 g.
- `gemini.js`: leitura de foto do prato (câmera ou galeria, inclusive print de pedido do iFood), foto da dieta e frases não reconhecidas, com a chave grátis do Gemini que a pessoa cola no app (fica só no localStorage do celular; nunca commitar chave).
- `lista.js`: a lista de substituição (não muda). Cada item = 1 porção do grupo.
- `firebase-config.js`, `firestore.rules`: login Google + Firestore (`users/{uid}/data/profile`, `users/{uid}/days/AAAA-MM-DD`).
- `sw.js`: offline. **Ao mudar qualquer arquivo do app, suba `VERSAO` em `sw.js` e `APP_VERSAO` em `app.js`.**

Escreva toda a interface em português do Brasil, em linguagem simples.

## Quando a pessoa mandar a foto de uma dieta nova

A dieta fica só no Firebase dela (é privada); **não** grave a dieta no repositório. Leia a foto e responda com um **código da dieta** para ela colar no app em *Minha dieta → Atualizar a dieta*.

1. Separe por refeição (nome e horário, se houver).
2. Converta cada item em **porções dos grupos** abaixo, usando `lista.js` (quantidade comida ÷ gramas de 1 porção daquele item). Ex.: 1 pão francês (50 g) = 2 porções de Pão; 120 g de peito de frango = 1 porção de Carne ou ovo. Se a dieta já disser "2 porções de pão", use direto.
3. Guarde o texto original do item em `text`. Folhas/vegetais crus à vontade: grupo `Vegetal cru ou cozido`, `n: 0`.
4. Se a dieta trouxer metas de kcal/macros, coloque em `targets`; senão `null`.

Grupos válidos (nome exato): `Pão`, `Recheio ou molho`, `Carne ou ovo`, `Arroz`, `Feijão`, `Leite`, `Fruta`, `Vegetal refogado`, `Vegetal cru ou cozido`, `Castanha`.

Formato (uma linha só, para copiar fácil no celular):

```json
{"meals":[{"name":"Café da manhã","time":"07:00","portions":[{"group":"Pão","n":2,"text":"1 pão francês"},{"group":"Leite","n":1,"text":"1 copo de leite desnatado"}],"notes":""}],"targets":null,"notes":"orientações gerais curtas"}
```

Antes de entregar, salve o código em um arquivo temporário (fora do repositório) e confira:

```bash
node tools/checar-dieta.mjs < /caminho/dieta.json
```

Ele mostra calorias e proteína por refeição, para comparar com a dieta, e imprime o código final em uma linha.

## Alimento que o app não reconhece

Se a pessoa disser que um alimento não foi reconhecido, adicione em `PREF` (se existir na lista) ou em `EXTRA` (fora da lista) no `alimentos.js`, com os macros TACO por 100 g, e suba a versão do `sw.js`.
