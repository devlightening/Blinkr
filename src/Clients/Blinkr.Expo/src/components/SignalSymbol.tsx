import { Users, Clock3, Sparkles, Tag, TriangleAlert, Eye, MapPin } from 'lucide-react-native';
import type { SignalType } from '../types';

// The icon map stays local to this component (not in signalCatalog.ts): that file is compiled into the
// plain-Node pure-logic test bundles, which cannot parse `lucide-react-native`'s dependency on
// `react-native` itself outside a bundler (see the comment at the top of signalCatalog.ts).
export function SignalSymbol({ type, color, size = 20 }: { type?: SignalType | null; color: string; size?: number }) {
  const Icon = ({ Crowd: Users, Queue: Clock3, Event: Sparkles, Offer: Tag, TemporaryStatus: TriangleAlert, GeneralObservation: Eye, NewOpening: MapPin })[type ?? 'GeneralObservation'] ?? Eye;
  return <Icon size={size} color={color} strokeWidth={2} />;
}
