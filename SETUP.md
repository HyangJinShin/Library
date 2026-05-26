# 나의 서고 — 설정 가이드

총 3단계입니다. 기술 지식 없이도 따라 하실 수 있습니다.

---

## 1단계: Firebase 프로젝트 만들기 (책 저장소)

1. [console.firebase.google.com](https://console.firebase.google.com) 접속 (구글 계정으로 로그인)
2. **"프로젝트 만들기"** 클릭
3. 프로젝트 이름 입력 (예: `my-book-library`) → **"계속"**
4. Google Analytics 화면 → **"지금은 사용 안 함"** 또는 그냥 **"프로젝트 만들기"**
5. 완료될 때까지 기다린 후 **"계속"** 클릭

---

## 2단계: Firestore 데이터베이스 만들기

1. 왼쪽 사이드바 → **"빌드"** → **"Firestore Database"** 클릭
2. **"데이터베이스 만들기"** 클릭
3. 모드 선택: **"테스트 모드로 시작"** 선택 → **"다음"**
4. 위치: **`asia-northeast3 (Seoul)`** 선택 → **"완료"**

잠시 후 빈 데이터베이스가 만들어집니다.

> **보안 규칙 갱신 (30일 후 필요):**
> Firestore → "규칙" 탭에서 아래 내용으로 교체 후 "게시":
> ```
> rules_version = '2';
> service cloud.firestore {
>   match /databases/{database}/documents {
>     match /books/{document=**} {
>       allow read, write: if true;
>     }
>   }
> }
> ```

---

## 3단계: 설정값 복사 → config.js에 붙여넣기

1. Firebase 콘솔 왼쪽 사이드바 → 프로젝트 설정 (⚙️ 톱니바퀴)
2. **"일반"** 탭 → 아래로 스크롤 → **"앱"** 섹션
3. 앱이 없다면 **`</>`** (웹 앱) 아이콘 클릭 → 닉네임 입력 → **"앱 등록"**
4. **`firebaseConfig`** 코드 블록이 나타나면 안에 있는 값들을 확인

5. `js/config.js` 파일을 텍스트 에디터로 열고, `YOUR_API_KEY` 등의 자리표시자를 실제 값으로 교체:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",          // ← Firebase에서 복사
  authDomain:        "my-library.firebaseapp.com",
  projectId:         "my-library-xxxxx",
  storageBucket:     "my-library-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc123"
};
```

---

## 4단계: GitHub Pages로 무료 배포

### GitHub 계정이 없다면
- [github.com](https://github.com) → **"Sign up"** → 이메일, 비밀번호, 사용자명 입력

### 파일 올리기
1. 로그인 후 [github.com/new](https://github.com/new) 클릭
2. Repository name: `book-library`
3. **Public** 선택 (무료 배포 조건)
4. **"Create repository"** 클릭
5. 새 저장소 페이지에서 **"uploading an existing file"** 링크 클릭
6. `book-library` 폴더 안의 파일/폴더를 모두 드래그 앤 드롭
   - `index.html`, `add.html`, `css` 폴더, `js` 폴더 전부 포함
7. 페이지 아래 **"Commit changes"** 클릭

### GitHub Pages 활성화
1. 저장소 상단 **"Settings"** 탭
2. 왼쪽 메뉴 **"Pages"**
3. Source: **"Deploy from a branch"**
4. Branch: **main** / **(root)** → **"Save"**
5. 1~2분 후 `https://[내GitHub아이디].github.io/book-library` 로 접속 가능

---

## 사용 방법

### 책 추가하기
1. 웹사이트에서 **"+ 책 추가"** 클릭
2. **📷 스캔** 버튼 → 스마트폰 카메라로 책 뒷면 바코드 스캔
   - 또는 ISBN 13자리 숫자를 직접 입력 후 **"검색"**
3. 표지·제목·저자가 자동으로 채워지면 확인 후 **"서고에 추가"**

### ISBN이 없는 책
- 검색란 비우고 **"검색"** 클릭 → 직접 입력 폼이 열림

---

## 문제 해결

| 증상 | 해결 |
|------|------|
| 책이 안 불러와짐 | `js/config.js` Firebase 값 확인 |
| 카메라가 안 열림 | 브라우저 카메라 권한 허용 (iOS Safari, Android Chrome 권장) |
| 한국 책 표지가 없음 | 나타나는 폼에서 표지 URL 직접 입력 가능 |
| 저장이 안 됨 | Firestore 보안 규칙 확인 (위 2단계 참조) |
