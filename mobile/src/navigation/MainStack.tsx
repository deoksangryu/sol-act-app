import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { NoticesScreen } from '../screens/NoticesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { VideoScreen } from '../screens/VideoScreen';
import { DietScreen } from '../screens/DietScreen';
import { ClassesScreen } from '../screens/ClassesScreen';
import { MusicScreen } from '../screens/MusicScreen';
import { RecordScreen } from '../screens/RecordScreen';
import { ExchangeScreen } from '../screens/ExchangeScreen';
import { AdminStudentDetail } from '../screens/AdminStudentDetail';
import { AIReviseScreen } from '../screens/AIReviseScreen';
import { ScenePartnerScreen } from '../screens/ScenePartnerScreen';
import { ReadingDetailScreen } from '../screens/ReadingDetailScreen';
import { ContentAdminScreen } from '../screens/ContentAdminScreen';
import { MediaPlayerScreen } from '../screens/MediaPlayerScreen';
import { MockTestScreen } from '../screens/MockTestScreen';
import { MockTestVideosScreen } from '../screens/MockTestVideosScreen';
import { MockTestAdminScreen } from '../screens/MockTestAdminScreen';
import { MockTestDetailScreen } from '../screens/MockTestDetailScreen';
import { WorkAnalysisScreen } from '../screens/WorkAnalysisScreen';
import { WorkAnalysisWizardScreen } from '../screens/WorkAnalysisWizardScreen';
import { WorkAnalysisFeedbackScreen } from '../screens/WorkAnalysisFeedbackScreen';
import { WorkAnalysisReviewScreen } from '../screens/WorkAnalysisReviewScreen';

const Stack = createNativeStackNavigator();

// 인증된 메인: 역할탭 + 헤더/딥링크에서 여는 오버레이(공지·알림·프로필·영상)
export function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="tabs" component={TabNavigator} />
      <Stack.Screen name="notices" component={NoticesScreen} />
      <Stack.Screen name="notifications" component={NotificationsScreen} />
      <Stack.Screen name="profile" component={ProfileScreen} />
      {/* 영상: 학생=내 영상 갤러리(재생·피드백확인·업로드), 교사/원장=전체 영상 리뷰(재생+피드백작성) */}
      <Stack.Screen name="videos" component={VideoScreen} />
      {/* 체중·식단: 학생=본인 기록, 교사/원장=학생 식단/체중 열람 */}
      <Stack.Screen name="diet" component={DietScreen} />
      {/* 수업·수업일지: 교사=수업일지 작성·학생메모, 학생=전달분 열람 */}
      <Stack.Screen name="classes" component={ClassesScreen} />
      {/* 무용음악: 재생(배속)·다운로드 요청, 재생 시간은 연습으로 인정 */}
      <Stack.Screen name="music" component={MusicScreen} />
      {/* 연기 녹음: 마이크 녹음 → 포트폴리오 업로드(피드백 흐름 합류) */}
      <Stack.Screen name="record" component={RecordScreen} />
      {/* 박수 교환소: 모은 박수로 피드백권·프리즈 등 교환 */}
      <Stack.Screen name="exchange" component={ExchangeScreen} />
      {/* 학생 종합 상세(원장·교사): 갈채·영상·체중·식단·연습일지 한 화면 */}
      <Stack.Screen name="studentDetail" component={AdminStudentDetail} />
      {/* AI 면접 질의응답 첨삭(학생): 질문+답변 → 개선 답변·개선점·총평 */}
      <Stack.Screen name="aiRevise" component={AIReviseScreen} />
      {/* AI 상대역 연습(학생): 내 대사+상대 등장 표시 → AI가 상대 대사 채움, 숨긴 채 TTS로 듣고 반응 */}
      <Stack.Screen name="scenePartner" component={ScenePartnerScreen} />
      {/* 작품 읽을거리 상세(학생): 배움 탭 읽을거리 카드 → 본문 열람 */}
      <Stack.Screen name="readingDetail" component={ReadingDetailScreen} />
      {/* 원장 콘텐츠 관리: 상식퀴즈·읽을거리·시청각·명대사 등록/수정/삭제 */}
      <Stack.Screen name="contentAdmin" component={ContentAdminScreen} />
      {/* 시청각 자료 재생(학생): 유튜브 임베드 or 업로드 영상 */}
      <Stack.Screen name="mediaPlayer" component={MediaPlayerScreen} />
      {/* 모의테스트 — 학생: 내 목록+음원 업로드 / 원장: 생성·순번·음원수집·영상배포·공지 */}
      <Stack.Screen name="mockTest" component={MockTestScreen} />
      <Stack.Screen name="mockTestVideos" component={MockTestVideosScreen} />
      <Stack.Screen name="mockTestAdmin" component={MockTestAdminScreen} />
      <Stack.Screen name="mockTestDetail" component={MockTestDetailScreen} />
      {/* 작품분석 — 학생: 목록/위저드/받은첨삭 / 교사·원장: 첨삭 작성 */}
      <Stack.Screen name="workAnalysis" component={WorkAnalysisScreen} />
      <Stack.Screen name="workAnalysisWizard" component={WorkAnalysisWizardScreen} />
      <Stack.Screen name="workAnalysisFeedback" component={WorkAnalysisFeedbackScreen} />
      <Stack.Screen name="workAnalysisReview" component={WorkAnalysisReviewScreen} />
    </Stack.Navigator>
  );
}
