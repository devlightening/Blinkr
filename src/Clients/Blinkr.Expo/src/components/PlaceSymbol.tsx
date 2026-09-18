import { Coffee, Cross, GraduationCap, Landmark, MapPin, ShoppingBasket, Trees, Utensils } from 'lucide-react-native';
export function PlaceSymbol({ category, color, size = 20 }: { category?: string | null; color: string; size?: number }) {
  const Icon = ({ MOSQUE: Landmark, PLACE_OF_WORSHIP: Landmark, PARK: Trees, PLAYGROUND: Trees, CAFE: Coffee, RESTAURANT: Utensils, PHARMACY: Cross, EDUCATION: GraduationCap, SHOP: ShoppingBasket, SUPERMARKET: ShoppingBasket } as Record<string, typeof MapPin>)[category?.toUpperCase() ?? ''] ?? MapPin;
  return <Icon color={color} size={size} strokeWidth={2} />;
}
