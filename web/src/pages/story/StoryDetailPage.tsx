import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { addStoryComment, getStory, getStoryComments } from "../../api/client";
import type { StoryComment, StoryRecord } from "../../types";

/**
 * /stories/:storyId
 * 페이지 트리(routeTree.ts)의 "stories.detail" 노드에 해당하는 화면.
 * 구현 시 RoutePlaceholder 를 실제 UI 로 교체하고, routeTree 의 status 를 DONE 으로 바꾼다.
 */
export function StoryDetailPage() {
  const { storyId = "" } = useParams();
  const [story, setStory] = useState<(StoryRecord & { address: string; imageUrl: string | null; commentCount: number }) | null>(null);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([getStory(storyId), getStoryComments(storyId)]).then(([nextStory, nextComments]) => { setStory(nextStory); setComments(nextComments); }).catch((reason) => setError(reason instanceof Error ? reason.message : "기록을 불러오지 못했습니다.")); }, [storyId]);
  if (error) return <main className="route-placeholder"><h1>기록을 볼 수 없습니다</h1><p>{error}</p><Link to="/stories">함께 탭으로 돌아가기</Link></main>;
  if (!story) return <main className="route-placeholder"><h1>여행 기록을 불러오는 중입니다…</h1></main>;
  const submit = async () => { if (!body.trim()) return; const created = await addStoryComment(story.id, body.trim()); setComments((items) => [...items, created]); setBody(""); };
  return <main className="story-detail-page"><Link to="/stories" className="story-detail-back">함께 탭으로 돌아가기</Link><article><header><span>{story.visitVerified ? "방문 인증 기록" : "여행 기록"}</span><h1>{story.placeName}</h1><p>{story.areaLabel} · {story.authorLabel}</p></header>{(story.images[0] || story.imageUrl) && <img src={story.images[0] || story.imageUrl || ""} alt={`${story.placeName} 여행 사진`} />}<p className="story-detail-copy">{story.content}</p><section className="story-detail-comments"><h2>댓글 {comments.length}</h2>{comments.length === 0 && <p>아직 댓글이 없습니다. 첫 여행 팁을 남겨보세요.</p>}{comments.map((item) => <p key={item.id}><strong>{item.authorLabel}</strong>{item.body}</p>)}<div><input value={body} maxLength={500} placeholder="여행 팁을 묻거나 답해보세요" onChange={(event) => setBody(event.target.value)} /><button type="button" onClick={() => void submit()}>등록</button></div></section></article></main>;
}
