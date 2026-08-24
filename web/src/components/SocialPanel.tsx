import { useEffect, useMemo, useState } from "react";
import { createStory, followUser, getStories, reportStory } from "../api/client";
import type { ItineraryOutput, StoryRecord } from "../types";

const shortAuthor = (label: string) => label.replace(/^여행자\s*/, "");
const storyInitial = (story: StoryRecord) => shortAuthor(story.authorLabel).slice(0, 1) || "L";

export function SocialPanel({ itinerary }: { itinerary: ItineraryOutput }) {
  const items = itinerary.days.flatMap((day) => day.items);
  const [publicStories, setPublicStories] = useState<StoryRecord[]>([]);
  const [followingPosts, setFollowingPosts] = useState<StoryRecord[]>([]);
  const [selectedStory, setSelectedStory] = useState<StoryRecord | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [placeId, setPlaceId] = useState(items[0]?.placeId ?? "");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [visibility, setVisibility] = useState("PUBLIC");
  const [publishNow, setPublishNow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    try {
      const [all, followed] = await Promise.all([getStories(false), getStories({ following: true })]);
      setPublicStories(all); setFollowingPosts(followed);
      setSelectedStory((current) => current ? all.find((story) => story.id === current.id) ?? null : null);
    } catch { setPublicStories([]); setFollowingPosts([]); }
  };
  useEffect(() => { void load(); }, []);

  const storyTray = useMemo(() => {
    const latestByAuthor = new Map<string, StoryRecord>();
    publicStories.forEach((story) => { if (!latestByAuthor.has(story.authorId)) latestByAuthor.set(story.authorId, story); });
    return [...latestByAuthor.values()].slice(0, 14);
  }, [publicStories]);

  const selected = items.find((item) => item.placeId === placeId);
  const chooseImage = (file?: File) => {
    if (!file) return;
    if (file.size > 750_000) { setNotice("이미지는 750KB 이하만 올릴 수 있습니다."); return; }
    const reader = new FileReader(); reader.onload = () => setImage(String(reader.result)); reader.readAsDataURL(file);
  };
  const submit = async () => {
    if (!selected || !content.trim()) return;
    try {
      const result = await createStory({ placeId, itineraryItemId: selected.itemId, content: content.trim(), images: image ? [image] : [], visibility, publishMode: publishNow ? "NOW" : "AFTER_TRIP", petTagged: itinerary.trip.hasPet });
      setContent(""); setImage(null); setComposerOpen(false);
      setNotice(result.delayed ? "여행 종료 후 공개되도록 저장했습니다. 사진의 위치정보는 제거됩니다." : "여행 기록을 공개했습니다.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "여행 기록을 저장하지 못했습니다."); }
  };
  const toggleFollow = async (story: StoryRecord) => { await followUser(story.authorId, story.isFollowing); await load(); };

  return <section className="social-panel social-home" aria-label="함께 여행 피드">
    <section className="people-stories" aria-labelledby="story-tray-title">
      <div className="social-section-heading"><div><span>지금 여행 중</span><h2 id="story-tray-title">여행자 스토리</h2></div><small>최근 공유된 순간</small></div>
      <div className="story-rail" role="list">
        {storyTray.length === 0 && <div className="story-rail-empty"><strong>첫 번째 여행 순간을 기다리고 있어요</strong><span>공개된 스토리가 생기면 여기에 먼저 보여드릴게요.</span></div>}
        {storyTray.map((story) => <button type="button" className="story-bubble" role="listitem" key={story.id} onClick={() => setSelectedStory(story)} aria-label={`${story.authorLabel}의 ${story.placeName} 스토리 보기`}>
          <span className="story-ring"><span className="story-thumb">{story.images[0] ? <img src={story.images[0]} alt="" /> : <b>{storyInitial(story)}</b>}</span></span><strong>{shortAuthor(story.authorLabel)}</strong><small>{story.areaLabel || story.placeName}</small>
        </button>)}
      </div>
    </section>

    <section className="following-feed-section" aria-labelledby="following-feed-title">
      <div className="social-section-heading"><div><span>내가 고른 여행자</span><h2 id="following-feed-title">팔로잉 피드</h2></div><small>{followingPosts.length}개의 새 기록</small></div>
      {followingPosts.length === 0 ? <div className="following-empty"><strong>아직 팔로우한 여행자의 게시물이 없어요</strong><p>위 스토리를 열어 마음에 드는 여행자를 팔로우하면, 새 여행 기록이 이곳에 차분히 쌓입니다.</p></div> : <div className="following-posts">
        {followingPosts.map((story) => <article className="following-post" key={story.id}>
          <header><div className="post-author"><span>{storyInitial(story)}</span><div><strong>{story.authorLabel}</strong><small>{story.areaLabel} · {story.placeName}</small></div></div><button type="button" className="following-button" onClick={() => void toggleFollow(story)}>팔로잉</button></header>
          {story.images[0] ? <img className="post-photo" src={story.images[0]} alt={`${story.placeName}에서 공유한 여행 사진`} /> : <button type="button" className="post-text-cover" onClick={() => setSelectedStory(story)}><span>{story.placeName}</span><strong>{story.content}</strong></button>}
          <div className="post-body">{story.images[0] && <p><strong>{story.authorLabel}</strong> {story.content}</p>}<div className="post-meta"><span>{story.visitVerified ? "방문 확인" : "여행 기록"} · {new Date(story.publishAt).toLocaleDateString("ko-KR")}</span>{story.moderationStatus === "REVIEW" ? <em>검토 중</em> : <button type="button" onClick={async () => { await reportStory(story.id); await load(); }}>신고</button>}</div></div>
        </article>)}
      </div>}
    </section>

    <section className="my-story-area" aria-labelledby="my-story-title">
      <div><span>MY TRAVEL NOTE</span><h2 id="my-story-title">내 여행 기록 남기기</h2><p>피드를 둘러본 뒤, 오늘의 기억을 한 장면으로 남겨보세요.</p></div>
      <button type="button" className="composer-toggle" aria-expanded={composerOpen} onClick={() => setComposerOpen((open) => !open)}>{composerOpen ? "작성 닫기" : "기록 작성"}</button>
      {composerOpen && <div className="story-composer">
        <label><span>장소</span><select aria-label="스토리 장소" value={placeId} onChange={(event) => setPlaceId(event.target.value)}>{items.map((item) => <option key={item.itemId} value={item.placeId}>{item.nameKo}</option>)}</select></label>
        <label><span>기록</span><textarea value={content} maxLength={500} placeholder="이 장소에서 오래 기억하고 싶은 순간은 무엇인가요?" onChange={(event) => setContent(event.target.value)} /></label>
        <div className="story-options"><label className="image-picker">사진 선택<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseImage(event.target.files?.[0])} /></label><select aria-label="공개 범위" value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="PUBLIC">전체 공개</option><option value="FOLLOWERS">팔로워 공개</option><option value="PRIVATE">나만 보기</option></select><label className="publish-check"><input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} /> 지금 공개</label><button type="button" onClick={() => void submit()}>저장하기</button></div>
        {publishNow && <p className="privacy-warning">여행 중 공개할 때는 현재 위치가 드러나지 않도록 지역 단위로만 표시합니다.</p>}{image && <img className="story-preview" src={image} alt="업로드할 스토리 미리보기" />}
      </div>}
    </section>
    {notice && <p className="feature-notice" role="status">{notice}</p>}

    {selectedStory && <div className="story-viewer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedStory(null); }}>
      <article className="story-viewer" role="dialog" aria-modal="true" aria-labelledby="story-viewer-title">
        <header><div className="post-author"><span>{storyInitial(selectedStory)}</span><div><strong id="story-viewer-title">{selectedStory.authorLabel}</strong><small>{selectedStory.areaLabel} · {selectedStory.placeName}</small></div></div><button type="button" className="viewer-close" onClick={() => setSelectedStory(null)} aria-label="스토리 닫기">닫기</button></header>
        {selectedStory.images[0] ? <img src={selectedStory.images[0]} alt={`${selectedStory.placeName}에서 공유한 여행 사진`} /> : <div className="viewer-text"><span>{selectedStory.placeName}</span><p>{selectedStory.content}</p></div>}
        <div className="viewer-copy">{selectedStory.images[0] && <p>{selectedStory.content}</p>}<div><span>{new Date(selectedStory.publishAt).toLocaleDateString("ko-KR")}</span>{!selectedStory.mine && <button type="button" onClick={() => void toggleFollow(selectedStory)}>{selectedStory.isFollowing ? "팔로잉 취소" : "팔로우"}</button>}</div></div>
      </article>
    </div>}
  </section>;
}
