// ──────────────────────────────────────────────────────────────
//  Firebase 설정
//  SETUP.md 가이드를 따라 Firebase 콘솔에서 복사한 값을 아래에 붙여넣으세요.
// ──────────────────────────────────────────────────────────────
// 카카오 Developers에서 발급받은 REST API 키
const KAKAO_API_KEY = "abfb4aa5996f384fef22e791bd0178e4";

const firebaseConfig = {
  apiKey:            "AIzaSyC7ItllT5inbpXbCMs_G5JvcXDexQHRpk4",
  authDomain:        "h-s-library.firebaseapp.com",
  projectId:         "h-s-library",
  storageBucket:     "h-s-library.firebasestorage.app",
  messagingSenderId: "331689388194",
  appId:             "1:331689388194:web:05ae7ccbbab51c22460ffb"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
