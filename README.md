# Prato Certo

Diário alimentar para o celular: lê o que você comeu ("30g de arroz", "macarrão com carne tudo 140g"), conta as porções da sua lista de substituição e mostra quanto falta de proteína e calorias para fechar a dieta.

- Abra em https://portugalmanu.github.io/pratocerto/ e toque em **Instalar app**.
- Os dados ficam no Firebase da sua conta Google (configure em `firebase-config.js`; regras em `firestore.rules`).
- Dieta nova: mande a foto para o Claude Code, ele gera o código da dieta e você cola em *Minha dieta → Atualizar a dieta*.
