# CS · Төгсөгчид 2026

Next.js 14 (App Router) + TypeScript + Tailwind + Firebase (Auth, Firestore, Storage) ашигласан төгсөлтийн вэб.

## Боломжууд
- 🕰 **Нүүр хуудас** — 2026.05.28 хүртэлх амьд тоологч (countdown).
- 👥 **Төгсөгчид** — Бүртгэлтэй төгсөгч бүрд хувийн хуудас. Дүү нар захидал/ерөөл бичнэ.
- 💛 **Хандивын булан** — Зорилго vs цугласан хувь, хандивлагчдын жагсаалт, дансны мэдээлэл.
- 📸 **Зургийн булан** — Зураг upload, 3 төрлийн frame (Polaroid / Алтан / Сонгодог).
- 👕 **Логоны санал асуулга** — Лого upload, ❤️ дарж дэмжих, олон саналаар эхэндээ ордог. Тэргүүлэгч лого футболкан дээр харагдана.

## Тохируулга

### 1. Хамаарал суулгах
```powershell
npm install
```

### 2. Firebase төсөл үүсгээд `.env.local` бүтээх
`.env.local.example` файлыг хуулж `.env.local` гэж нэрлэн, [Firebase Console](https://console.firebase.google.com/) → Project Settings → Web app дотроос утгыг бөглөнө:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 3. Firebase үйлчилгээ идэвхжүүлэх
- **Authentication** → Sign-in method: Email/Password ба Google.
- **Firestore Database** → "Start in production".
- **Storage** → үүсгэх.

### 4. Дүрмүүд (rules) deploy
`firestore.rules`, `storage.rules`-г Firebase Console-оор хуулж тавих, эсвэл Firebase CLI-аар:
```powershell
npm install -g firebase-tools
firebase login
firebase init   # firestore + storage сонгох, одоо байгаа файлуудаа сонгох
firebase deploy --only firestore:rules,storage:rules
```

### 5. Локалаар ажиллуулах
```powershell
npm run dev
```
http://localhost:3000

### 6. Production build
```powershell
npm run build
npm start
```
Vercel дээр deploy хийхэд `.env.local`-ийн утгуудыг Vercel project settings-д тохируулна.

## Огноо солих
`src/lib/constants.ts` доторх `GRADUATION_DATE_ISO` утгыг солино.

## Бүтэц
```
src/
  app/
    page.tsx                 # Нүүр + countdown
    login/, signup/          # Auth
    profiles/                # Жагсаалт + [uid]/ дэлгэрэнгүй
    fund/                    # Хандив
    photos/                  # Зургийн булан
    logos/                   # Логоны санал асуулга
  components/
    Navbar.tsx, Countdown.tsx
  lib/
    firebase.ts, auth.tsx, constants.ts
firestore.rules
storage.rules
```

## Тэмдэглэл
- `fund/meta` баримтын `goal` талбараас хандивын зорилгыг тохируулна.
- Лого санал — нэг хэрэглэгч нэг логонд нэг ❤️. `votes/{uid}` дотор нь хадгалагдана.
- Анхдагч өгөгдөл байхгүй; хэрэглэгч `Бүртгүүлэх` дээр **"Би энэ удаа төгсөж байгаа"** гэж тэмдэглэвэл `users` коллекшнд `isGraduate: true` болж, `Төгсөгчид` хуудсанд харагдана.
