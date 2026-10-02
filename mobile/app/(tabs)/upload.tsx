import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../../src/auth/session';
import { Button, ErrorNotice, Field, Icon, palette, Screen } from '../../src/components/ui';
import { localMediaUrl } from '../../src/features/feed/video-card';
import { errorMessage, useApi } from '../../src/lib/api';
import type { Upload } from '../../src/types';

export default function UploadScreen() {
  const api = useApi();
  const { getToken, isDemo } = useSession();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [upload, setUpload] = useState<Upload | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const task = useRef<FileSystem.UploadTask | null>(null);
  const mounted = useRef(true);
  const uploadId = upload?.id;
  const uploadStatus = upload?.status;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; void task.current?.cancelAsync(); }; }, []);
  useEffect(() => {
    if (!uploadId || !uploadStatus || ['ready', 'failed'].includes(uploadStatus) || busy) return;
    let alive = true;
    let fetching = false;
    const poll = async () => {
      if (fetching) return;
      fetching = true;
      try { const next = await api.get<Upload>(`uploads/${encodeURIComponent(uploadId)}`); if (alive) { setUpload(next); setError(null); } }
      catch (err) { if (alive) setError(errorMessage(err)); }
      finally { fetching = false; }
    };
    const interval = setInterval(() => void poll(), 3000);
    void poll();
    return () => { alive = false; clearInterval(interval); };
  }, [api, uploadId, uploadStatus, busy]);

  const pick = async () => {
    setError(null);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { setError('Allow access to your video library to choose a video.'); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, quality: 1, videoMaxDuration: 180 });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (selected.fileSize && selected.fileSize > 100 * 1024 * 1024) { setError('Choose a video smaller than 100 MB.'); return; }
      if (selected.mimeType && !['video/mp4', 'video/quicktime', 'video/webm'].includes(selected.mimeType)) { setError('Choose an MP4, MOV, or WebM video.'); return; }
      setAsset(selected); setUpload(null); setProgress(0);
    } catch (err) { setError(errorMessage(err)); }
  };
  const publish = async () => {
    if (!asset || busy) return;
    setBusy(true); setError(null); setProgress(0);
    try {
      const extension = (asset.fileName || asset.uri).split('.').pop()?.toLowerCase();
      const contentType = asset.mimeType || (extension === 'mov' ? 'video/quicktime' : extension === 'webm' ? 'video/webm' : 'video/mp4');
      const next = await api.post<Upload>('uploads', { caption: caption.trim(), contentType });
      setUpload(next);
      if (!next.uploadUrl) throw new Error('No upload destination was returned. Please try again.');
      const destination = next.provider === 'local' ? localMediaUrl(next.uploadUrl) : next.uploadUrl;
      const token = await getToken();
      const headers = { 'Content-Type': contentType, ...(next.provider === 'local' && token ? { Authorization: `Bearer ${token}` } : {}) };
      if (Platform.OS === 'web') {
        const blob = asset.file || await fetch(asset.uri).then(response => response.blob());
        if (!blob) throw new Error('Could not read the selected video. Please choose it again.');
        if (blob.size > 100 * 1024 * 1024) throw new Error('Choose a video smaller than 100 MB.');
        const response = await fetch(destination, { method: 'PUT', headers, body: blob });
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.message || 'The upload failed. Please try again.');
        }
      } else {
        task.current = FileSystem.createUploadTask(destination, asset.uri, { httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers }, event => {
          if (mounted.current && event.totalBytesExpectedToSend > 0) setProgress(event.totalBytesSent / event.totalBytesExpectedToSend);
        });
        const result = await task.current.uploadAsync();
        if (!result || result.status < 200 || result.status >= 300) {
          let message = 'The upload failed. Please try again.';
          try { message = JSON.parse(result?.body || '{}').message || message; } catch {}
          throw new Error(message);
        }
      }
      if (!mounted.current) return;
      setProgress(1);
      const result = await api.get<Upload>(`uploads/${encodeURIComponent(next.id)}`);
      setUpload(result);
    } catch (err) { if (mounted.current) { setError(errorMessage(err)); setUpload(null); } }
    finally { task.current = null; if (mounted.current) setBusy(false); }
  };
  return <Screen title="Create a Real">
    <Text style={styles.eyebrow}>YOUR PERSPECTIVE, SHARED.</Text>
    <Pressable onPress={() => void pick()} disabled={busy || upload?.status === 'processing'} accessibilityRole="button" accessibilityLabel="Choose a video" style={styles.drop}>
      <View style={styles.circle}><Icon name={asset ? 'film' : 'plus'} size={34} color={palette.accent} /></View>
      <Text style={styles.dropTitle}>{asset ? asset.fileName || 'Video selected' : 'Pick your moment'}</Text>
      <Text style={styles.detail}>{asset ? `${Math.round((asset.duration || 0) / 1000)} seconds · Tap to change` : 'MP4, MOV, or WebM · Up to 100 MB'}</Text>
    </Pressable>
    <Field label="Caption" placeholder="Tell the story behind your video…" value={caption} onChangeText={setCaption} multiline maxLength={500} editable={!busy && !upload} />
    <Text style={styles.counter}>{caption.length}/500</Text>
    <ErrorNotice error={error} />
    {busy && <View style={styles.status}><ActivityIndicator color={palette.accent} /><Text style={styles.statusText}>Uploading{progress > 0 ? ` · ${Math.round(progress * 100)}%` : '…'}</Text><View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%` }]} /></View></View>}
    {upload?.status === 'processing' || (upload?.status === 'pending' && !busy) ? <View style={styles.status}><ActivityIndicator color={palette.accent} /><Text style={styles.statusText}>Preparing your video…</Text><Text style={styles.detail}>It will appear in the feed when it’s ready.</Text></View> : null}
    {upload?.status === 'failed' && <ErrorNotice error="This video could not be processed. Please choose another video." />}
    {upload?.status === 'ready' && upload.videoId ? <View style={styles.status}><Icon name="check-circle" size={40} color={palette.success} /><Text style={styles.dropTitle}>Your Real is live.</Text><Button title="Watch your video" onPress={() => router.push({ pathname: '/video/[id]', params: { id: upload.videoId! } })} /><Button title="Create another" variant="secondary" onPress={() => { setAsset(null); setUpload(null); setCaption(''); }} /></View> : <Button title={isDemo ? 'Publish to local demo' : 'Publish Real'} disabled={!asset || Boolean(upload && upload.status !== 'failed')} loading={busy} onPress={() => void publish()} />}
    {isDemo && <Text style={styles.demo}>Local demo uploads stay on your computer. Sign in with your other demo account to see and interact with the post.</Text>}
  </Screen>;
}
const styles = StyleSheet.create({
  eyebrow: { color: palette.muted, letterSpacing: 2, fontSize: 10, fontWeight: '700', marginTop: 8 },
  drop: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#604050', borderRadius: 24, minHeight: 240, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, padding: 24, gap: 16 },
  circle: { width: 76, height: 76, borderRadius: 25, backgroundColor: '#30202b', alignItems: 'center', justifyContent: 'center' },
  dropTitle: { color: palette.text, fontSize: 20, fontWeight: '700', textAlign: 'center' }, detail: { color: palette.muted, fontSize: 13, lineHeight: 21, textAlign: 'center' },
  counter: { color: palette.muted, fontSize: 11, textAlign: 'right', marginTop: -8 },
  status: { backgroundColor: palette.surface, borderRadius: 20, padding: 24, gap: 16, alignItems: 'stretch' }, statusText: { color: palette.text, fontWeight: '600', textAlign: 'center' },
  progressTrack: { height: 5, backgroundColor: palette.border, borderRadius: 4, overflow: 'hidden' }, progressBar: { height: 5, backgroundColor: palette.accent }, demo: { color: palette.muted, fontSize: 12, lineHeight: 20, textAlign: 'center', marginTop: 8 },
});
