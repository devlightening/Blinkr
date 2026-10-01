import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { centerSquare, PHOTO_LARGE, PHOTO_SMALL } from './profilePhotoRules';

export { DISPLAY_NAME_MAX, displayNameState } from './profilePhotoRules';

async function sized(uri: string, crop: ReturnType<typeof centerSquare>, side: number, compress: number) {
  const context = ImageManipulator.manipulate(uri);
  context.crop(crop).resize({ height: side, width: side });
  const image = await context.renderAsync();
  // Re-encoding drops the camera's EXIF (with its GPS position); the server strips any metadata again anyway.
  const saved = await image.saveAsync({ compress, format: SaveFormat.JPEG });
  return saved.uri;
}

/**
 * Take or pick a picture, crop it square and make both sizes. Null when the person cancels or did not allow access.
 * Photos only: a profile picture is never a video.
 */
export async function pickProfilePhoto(source: 'camera' | 'library'): Promise<{ largeUri: string; smallUri: string } | null> {
  const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const options: ImagePicker.ImagePickerOptions = { allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front }) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const crop = centerSquare(asset.width, asset.height);
  return { largeUri: await sized(asset.uri, crop, PHOTO_LARGE, 0.85), smallUri: await sized(asset.uri, crop, PHOTO_SMALL, 0.82) };
}
