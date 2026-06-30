import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { Haptics } from '@capacitor/haptics';
import { createNoteId } from '../../services/storage';
import type { BoneNote, NoteImage } from '../../shared/types';
import { page1Assets } from '../../shared/assets';
import { plainTextFromRich, toEditableHtml } from '../../shared/notes/richText';
import { readImageFile } from '../../shared/media/images';

export function NoteEditorView({
  note,
  allTags,
  onSave,
  onRegisterBackHandler,
  onToast,
}: {
  note?: BoneNote;
  allTags: string[];
  onSave: (note: BoneNote) => Promise<void>;
  onRegisterBackHandler: (handler: (() => boolean) | null) => void;
  onToast: (message: string) => void;
}) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [tags, setTags] = useState<string[]>(note?.tags || []);
  const [images, setImages] = useState<NoteImage[]>(note?.images || []);
  const [tagInput, setTagInput] = useState('');
  const [fabOpen, setFabOpen] = useState(Boolean(note));
  const [showTags, setShowTags] = useState(false);
  const [showB, setShowB] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingImageDelete, setPendingImageDelete] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const contentInputRef = useRef<HTMLDivElement | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const lastTapTimeRef = useRef(0);

  useEffect(() => {
    setTitle(note?.title || '');
    setContent(note?.content || '');
    setTags(note?.tags || []);
    setImages(note?.images || []);
    setFabOpen(Boolean(note));
    setShowTags(false);
    setShowB(false);
    setPendingImageDelete(null);
    setPreviewImage('');
    if (contentInputRef.current) {
      contentInputRef.current.innerHTML = toEditableHtml(note?.content || '');
    }
  }, [note]);

  useEffect(() => {
    onRegisterBackHandler(() => {
      if (pendingImageDelete !== null) {
        setPendingImageDelete(null);
        return true;
      }

      if (previewImage) {
        setPreviewImage('');
        return true;
      }

      if (showB) {
        setShowB(false);
        return true;
      }

      if (showTags) {
        setShowTags(false);
        return true;
      }

      if (fabOpen) {
        setFabOpen(false);
        return true;
      }

      return false;
    });

    return () => onRegisterBackHandler(null);
  }, [fabOpen, onRegisterBackHandler, pendingImageDelete, previewImage, showB, showTags]);

  const clearPressTimer = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const savePage1Note = async () => {
    if (!title.trim()) {
      onToast('请填写标题');
      return;
    }

    if (!plainTextFromRich(content).trim()) {
      onToast('请填写内容');
      return;
    }

    const now = Date.now();
    await onSave({
      id: note?.id || createNoteId(),
      title: title.trim(),
      content,
      tags,
      images,
      audio: note?.audio,
      createdAt: note?.createdAt || now,
      updatedAt: now,
      pinned: note?.pinned || false,
      pinnedColor: note?.pinnedColor,
    });
  };

  const startPage1FabPress = () => {
    longPressed.current = false;
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      void Haptics.vibrate({ duration: 28 }).catch(() => undefined);
      void savePage1Note();
    }, 650);
  };

  const endPage1FabPress = () => {
    clearPressTimer();
    if (!longPressed.current) setFabOpen((current) => !current);
  };

  const addPage1Tag = (value = tagInput) => {
    const next = value.trim();
    if (!next) {
      onToast('请输入标签');
      return;
    }

    if (tags.includes(next)) {
      onToast('标签已存在');
      return;
    }

    setTags([...tags, next]);
    setTagInput('');
  };

  const handlePage1Files = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const remain = Math.max(0, 9 - images.length);
    if (remain === 0) {
      onToast('最多选择 9 张图片');
      return;
    }

    try {
      const converted = await Promise.all(files.slice(0, remain).map(readImageFile));
      setImages([...images, ...converted]);
      onToast(`已添加 ${converted.length} 张图片`);
    } catch {
      onToast('图片读取失败');
    }
  };

  const handleEditorTap = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, [contenteditable], img')) return;

    const now = performance.now();
    if (now - lastTapTimeRef.current < 300) {
      void savePage1Note();
    }
    lastTapTimeRef.current = now;
  };

  const confirmDeleteImage = () => {
    if (pendingImageDelete === null) return;
    setImages(images.filter((_, imageIndex) => imageIndex !== pendingImageDelete));
    setPendingImageDelete(null);
  };

  const toggleContentBold = () => {
    const editor = contentInputRef.current;
    if (!editor) return;

    editor.focus();
    const isBold = document.queryCommandState('bold');
    document.execCommand('bold');
    setContent(editor.innerHTML);
    onToast(isBold ? '关闭粗体' : '开启粗体');
  };

  return (
    <section className="page1-note-editor-screen">
      <div className="page1-top-white-fill" />
      <header className="page1-custom-nav-bar" aria-label="B·one">
        <h1 className="page1-nav-title">
          <span className="page1-nav-b">B</span>
          <span className="page1-nav-dot">·</span>
          <span className="page1-nav-o">o</span>
          <span className="page1-nav-n">n</span>
          <span className="page1-nav-e">e</span>
        </h1>
      </header>

      <div className="page1-note-container" onClick={handleEditorTap}>
        <div className="page1-title-section page1-clean-title">
          <label className="page1-card">
            <span className="page1-card-overlay" />
            <span className="page1-card-inner">
              <input
                className="page1-title-input page1-clean-title-input"
                value={title}
                maxLength={50}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="标题"
              />
            </span>
          </label>
        </div>

        {images.length > 0 && (
          <div className="page1-image-section">
            <div className="page1-image-scroll" aria-label="已选择图片">
              <div className="page1-image-list">
                {images.map((image, index) => (
                  <figure className="page1-image-item" key={image.id}>
                    <img
                      className="page1-selected-image"
                      src={image.dataUrl}
                      alt=""
                      onClick={() => setPreviewImage(image.dataUrl)}
                    />
                    <button
                      className="page1-image-delete"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingImageDelete(index);
                      }}
                      aria-label="删除图片"
                    >
                      <span className="page1-delete-icon">×</span>
                    </button>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="page1-content-section">
          <div
            ref={contentInputRef}
            className="page1-content-input"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="内容"
            data-placeholder="内容..."
            onBlur={() => setIsTyping(false)}
            onInput={(event) => {
              const editor = event.currentTarget;
              if (plainTextFromRich(editor.innerHTML).length > 10000) return;
              setContent(editor.innerHTML);
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
                event.preventDefault();
                toggleContentBold();
                return;
              }

              if (event.key === 'Enter') {
                event.preventDefault();
                document.execCommand('insertLineBreak');
                setContent(event.currentTarget.innerHTML);
              }
            }}
            onFocus={() => setIsTyping(true)}
          />
        </div>
      </div>

      <div className={`page1-fab page1-fab-flower ${fabOpen ? 'page1-fab-open' : ''}`}>
        {isTyping && (
          <button
            className="page1-fab-overlay"
            type="button"
            onClick={() => contentInputRef.current?.focus()}
            aria-label="继续输入"
          />
        )}
        <button
          className={`page1-btn page1-btn-circle page1-btn-lg page1-fab-trigger ${
            fabOpen ? 'page1-fab-trigger-mondrian-black' : ''
          }`}
          type="button"
          onPointerCancel={clearPressTimer}
          onPointerDown={startPage1FabPress}
          onPointerLeave={clearPressTimer}
          onPointerUp={endPage1FabPress}
          aria-label="展开菜单"
        >
          <img
            className={`page1-fab-image ${fabOpen ? 'page1-fab-image-hidden' : ''}`}
            src={page1Assets.fit}
            alt=""
            draggable="false"
          />
          <img
            className={`page1-custom-art-image ${fabOpen ? '' : 'page1-custom-art-image-hidden'}`}
            src={page1Assets.black}
            alt=""
            draggable="false"
          />
        </button>

        <button
          className="page1-btn page1-btn-circle page1-btn-lg page1-fab-btn page1-fab-btn-left-1"
          type="button"
          onClick={toggleContentBold}
          aria-label="粗体"
        >
          <img className="page1-fab-btn-image" src={page1Assets.white} alt="" draggable="false" />
        </button>

        <button
          className="page1-btn page1-btn-circle page1-btn-lg page1-fab-btn page1-fab-btn-left-2"
          type="button"
          onClick={() => setShowTags(true)}
          aria-label="标签"
        >
          <img className="page1-fab-btn-image" src={page1Assets.yellow} alt="" draggable="false" />
        </button>

        <button
          className="page1-btn page1-btn-circle page1-btn-lg page1-fab-btn page1-fab-btn-right-1"
          type="button"
          onClick={() => imageInputRef.current?.click()}
          aria-label="选择图片"
        >
          <img className="page1-fab-btn-image" src={page1Assets.blue} alt="" draggable="false" />
        </button>

        <button
          className="page1-btn page1-btn-circle page1-btn-lg page1-fab-btn page1-fab-btn-right-2"
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          aria-label="拍照"
        >
          <img className="page1-fab-btn-image" src={page1Assets.red} alt="" draggable="false" />
        </button>
      </div>

      <input
        ref={imageInputRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handlePage1Files}
      />
      <input
        ref={cameraInputRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePage1Files}
      />

      {showTags && (
        <div className="page1-tag-popup page1-tag-popup-visible">
          <button className="page1-tag-popup-overlay" type="button" onClick={() => setShowTags(false)} />
          <section className="page1-tag-card" onClick={(event) => event.stopPropagation()}>
            <h2 className="page1-card-title">标签管理</h2>

            {tags.length > 0 && (
              <div className="page1-card-section">
                <h3 className="page1-section-title">当前标签</h3>
                <div className="page1-tag-list">
                  {tags.map((tag) => (
                    <button
                      className="page1-tag-name page1-tag-current"
                      key={tag}
                      type="button"
                      onClick={() => setTags(tags.filter((item) => item !== tag))}
                    >
                      <span className="page1-tag-text">{tag}</span>
                      <span className="page1-tag-remove">×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="page1-card-section">
              <h3 className="page1-section-title">添加标签</h3>
              <div className="page1-input-section">
                <input
                  className="page1-tag-input"
                  value={tagInput}
                  maxLength={20}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addPage1Tag();
                  }}
                  placeholder="输入新标签"
                />
                <button className="page1-tag-add-btn" type="button" onClick={() => addPage1Tag()}>
                  +
                </button>
              </div>
            </div>

            {allTags.length > 0 && (
              <div className="page1-card-section">
                <h3 className="page1-section-title">历史标签</h3>
                <div className="page1-tag-list">
                  {allTags.map((tag) => (
                    <button
                      className={`page1-tag-name ${tags.includes(tag) ? 'page1-tag-disabled' : ''}`}
                      key={tag}
                      type="button"
                      onClick={() => addPage1Tag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="page1-card-actions">
              <button className="page1-action-btn page1-confirm-btn" type="button" onClick={() => setShowTags(false)}>
                确定
              </button>
              <button className="page1-close-btn" type="button" onClick={() => setShowTags(false)}>
                ×
              </button>
            </div>
          </section>
        </div>
      )}

      {showB && (
        <div className="page1-b-image-modal page1-b-image-modal-visible" onClick={() => setShowB(false)}>
          <div className="page1-b-image-modal-overlay" />
          <div className="page1-b-image-modal-content" onClick={(event) => event.stopPropagation()}>
            <img className="page1-b-image-display" src={page1Assets.b} alt="" onClick={() => setShowB(false)} />
          </div>
        </div>
      )}

      {previewImage && (
        <div className="modal-backdrop image-modal" onClick={() => setPreviewImage('')}>
          <img src={previewImage} alt="" onClick={(event) => event.stopPropagation()} />
        </div>
      )}

      {pendingImageDelete !== null && (
        <div className="page1-soft-modal-backdrop" onClick={() => setPendingImageDelete(null)}>
          <section className="page1-delete-dialog" onClick={(event) => event.stopPropagation()}>
            <h2>确定删除这张图片吗？</h2>
            <p>删除后只会从当前笔记里移除。</p>
            <div className="page1-dialog-actions">
              <button type="button" onClick={() => setPendingImageDelete(null)}>
                取消
              </button>
              <button className="danger" type="button" onClick={confirmDeleteImage}>
                删除
              </button>
            </div>
          </section>
        </div>
      )}

    </section>
  );
}
