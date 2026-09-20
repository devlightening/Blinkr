import {
  Coffee, Cross, Croissant, Dumbbell, Fuel, GraduationCap, Landmark, MapPin, Martini, Sandwich, ShoppingBag, ShoppingBasket, Stethoscope, Trees, Utensils, Bus,
} from 'lucide-react-native';

/** One glyph per normalised Place category (see CLAUDE.md 9.4). Unknown categories fall back to a pin, never to a wrong icon. */
const icons: Record<string, typeof MapPin> = {
  RESTAURANT: Utensils,
  FAST_FOOD: Sandwich,
  CAFE: Coffee,
  BAKERY: Croissant,
  BAR: Martini,
  ENTERTAINMENT: Martini,
  SHOP: ShoppingBag,
  SUPERMARKET: ShoppingBasket,
  PARK: Trees,
  PLAYGROUND: Trees,
  SPORT: Dumbbell,
  TOURISM: Landmark,
  MOSQUE: Landmark,
  PLACE_OF_WORSHIP: Landmark,
  EDUCATION: GraduationCap,
  HEALTH: Stethoscope,
  PHARMACY: Cross,
  TRANSPORT: Bus,
  FUEL: Fuel,
};

export function PlaceSymbol({ category, color, size = 20 }: { category?: string | null; color: string; size?: number }) {
  const Icon = icons[category?.toUpperCase() ?? ''] ?? MapPin;
  return <Icon color={color} size={size} strokeWidth={2} />;
}
