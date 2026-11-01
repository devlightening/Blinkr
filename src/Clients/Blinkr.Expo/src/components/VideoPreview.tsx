import { useVideoPlayer, VideoView } from 'expo-video';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  style?: StyleProp<ViewStyle>;
  uri: string;
  /** Native playback controls. Off when the video is only a backdrop behind other UI. */
  controls?: boolean;
};

export const VideoPreview = ({ uri, style, controls = true }: Props) => {
  const player = useVideoPlayer(uri);
  return <VideoView contentFit="cover" nativeControls={controls} player={player} style={style} />;
};
