import { ArrowLeft } from 'lucide-react';
import type { AppView } from '../../shared/types';
import { placeholderViews } from '../../shared/apiMeta';

export function PlaceholderView({
  view,
  onBack,
}: {
  view: Exclude<AppView, 'home' | 'settings' | 'note' | 'notes'>;
  onBack: () => void;
}) {
  const meta = placeholderViews[view];
  const Icon = meta.icon;

  return (
    <section className="placeholder-screen">
      <button className="back-chip" type="button" onClick={onBack}>
        <ArrowLeft size={20} />
        <span>首页</span>
      </button>
      <div className="placeholder-content">
        <Icon size={42} />
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
    </section>
  );
}
