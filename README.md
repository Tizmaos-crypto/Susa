# 🏨 예약 · 락커 관리 시스템

구글 폼 → 스프레드시트 기반 예약 확인 및 락커 배정 웹앱

## 배포 방법 (Vercel)

### 1. GitHub에 업로드
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/reservation-desk.git
git push -u origin main
```

### 2. Vercel에서 배포
1. [vercel.com](https://vercel.com) 로그인
2. **Add New → Project**
3. GitHub 저장소 선택 (reservation-desk)
4. Framework: **Vite** 자동 감지
5. **Deploy** 클릭 → 완료!

### 3. Google Apps Script 설정
1. 구글 폼 응답 스프레드시트 열기
2. 확장 프로그램 → Apps Script
3. `Code.gs`에 백엔드 코드 붙여넣기
4. 배포 → 새 배포 → 웹 앱 (모든 사용자 접근)
5. 배포 URL 복사

### 4. 웹앱 연결
- Vercel 배포 URL 접속
- Apps Script URL 입력 → 연결 완료!

## 시트 구조 (F, G열 수동 추가 필요)
| 열 | 내용 |
|---|---|
| A | 타임스탬프 (자동) |
| B | 예약자 성함 |
| C | 객실 호수 |
| D | 예약 날짜 |
| E | 이용 시간(부) |
| **F** | **락커 번호 (웹앱에서 입력)** |
| **G** | **메모 (웹앱에서 입력)** |
