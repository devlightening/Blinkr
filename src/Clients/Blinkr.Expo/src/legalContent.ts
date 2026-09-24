/**
 * Legal texts (plan-devam F2, P10.10). DRAFTS: every screen says so, and a lawyer must review them before release.
 * Kept in code, not in the i18n JSON, because the support address placeholder `{{DESTEK_EPOSTA}}` would be read as
 * an i18next interpolation there. Pure data, no React Native imports.
 */

/**
 * The support / appeal address (plan-devam F1, D-021). There is no real one yet and none is invented: until the owner
 * provides it this stays a visible placeholder. The App Store requires a working contact for user-generated content,
 * so this MUST be filled in before release (release checklist, Faz G).
 */
export const SUPPORT_EMAIL = '{{DESTEK_EPOSTA}}';
export const supportEmailReady = () => !/^\{\{.*\}\}$/.test(SUPPORT_EMAIL);

export type LegalDocId = 'community' | 'terms' | 'privacy';
export type LegalDoc = { title: string; updated: string; sections: Array<{ heading: string; body: string }> };

const UPDATED = '2026-09-24';

const tr: Record<LegalDocId, LegalDoc> = {
  community: {
    title: 'Topluluk kuralları',
    updated: UPDATED,
    sections: [
      { heading: 'Blinkr ne için var?', body: 'Blinkr, insanların bir yer hakkında daha hızlı ve doğru karar vermesi için taze, yere bağlı sinyaller paylaştığı bir haritadır. Paylaştığın her şey bu amaca hizmet etmeli.' },
      { heading: 'Doğru ve güncel paylaş', body: 'Yalnızca gördüğün, bildiğin şeyi paylaş. Eski fotoğrafları "şu an" gibi gösterme; galeriden eklenen eski kareler "Galeriden" olarak işaretlenir ve canlı durumu değiştirmez. Bilerek yanlış bilgi yaymak yasaktır.' },
      { heading: 'İnsanlara saygı göster', body: 'Tehdit, taciz, nefret söylemi, hedef gösterme ve aşağılama yasaktır. Başkalarının yüzünü, plakasını, kimlik veya adres bilgisini izinsiz paylaşma. Çocukların güvenliği için okul ve kreşlerde fotoğraf ve video paylaşılamaz.' },
      { heading: 'Zararlı içerik yok', body: 'Çıplaklık, cinsel içerik, şiddet, kendine zarar vermeyi özendiren içerik, yasa dışı mal ve hizmet satışı ve spam paylaşılamaz. Reklamı topluluk sinyali gibi gösterme.' },
      { heading: 'Bildir ve engelle', body: 'Kurallara uymayan bir sinyal, yorum, hikaye veya kişiyi bildirebilir ve engelleyebilirsin. Bildirimler incelenir; ağır ihlallerde içerik gizlenir, hesap kısıtlanabilir veya kapatılabilir.' },
      { heading: 'Yaptırımlar ve itiraz', body: `Uyarı, 24 saat paylaşım kısıtı, 7 gün askı ve kalıcı kapatma uygulanabilir. Bir karara itiraz etmek için ${SUPPORT_EMAIL} adresine kullanıcı adınla yaz.` },
    ],
  },
  terms: {
    title: 'Kullanım şartları',
    updated: UPDATED,
    sections: [
      { heading: 'Kabul', body: 'Blinkr’ı kullanarak bu şartları ve Topluluk kurallarını kabul etmiş olursun. Kabul etmiyorsan uygulamayı kullanma.' },
      { heading: 'Yaş', body: 'Blinkr’ı kullanmak için en az 13 yaşında olmalısın. 18 yaşından küçük hesaplar gizli başlar ve yalnızca arkadaşlarından mesaj alır.' },
      { heading: 'Hesabın', body: 'Hesabının güvenliğinden sen sorumlusun. Şifreni kimseyle paylaşma. Hesabını istediğin zaman Ayarlar > Hesap > Hesabı sil ile silebilirsin; 30 gün içinde giriş yaparak vazgeçebilirsin.' },
      { heading: 'Paylaştığın içerik', body: 'Paylaştığın içeriğin sahibi sensin. Blinkr’a, bu içeriği uygulamada göstermek, saklamak ve güvenlik amacıyla işlemek için gereken, devredilemez ve ücretsiz bir izin verirsin. Başkasının hakkı olan içeriği paylaşma.' },
      { heading: 'Bilginin niteliği', body: 'Sinyaller kullanıcıların gözlemleridir; Blinkr doğruluklarını garanti etmez. Önemli kararlarda (sağlık, güvenlik, acil durum) resmi kaynaklara başvur. Acil durumda 112’yi ara.' },
      { heading: 'Hizmetin değişmesi', body: 'Blinkr hizmeti geliştirebilir, değiştirebilir veya durdurabilir. Şartlar değişirse uygulama içinde bildirilir.' },
      { heading: 'İletişim', body: `Sorular ve itirazlar için: ${SUPPORT_EMAIL}` },
    ],
  },
  privacy: {
    title: 'Gizlilik politikası',
    updated: UPDATED,
    sections: [
      { heading: 'Topladığımız veriler', body: 'Hesap: kullanıcı adı, e-posta, şifrenin özeti (şifrenin kendisi değil), doğum yılı. Paylaşımlar: sinyal, yorum, hikaye, sohbet mesajı ve eklediğin medya. Konum: yalnızca paylaşırken ve Yakında/harita özellikleri için, cihazın konum izniyle.' },
      { heading: 'Konumun nasıl kullanılır?', body: 'Kesin cihaz konumun başka kullanıcılara hiçbir yerde gösterilmez. Haritada yerin merkezi ya da yaklaşık bir alan görünür. Konum, sinyalin o yerde yapıldığını sunucuda doğrulamak için kullanılır ve kayıtlara (loglara) yazılmaz.' },
      { heading: 'Fotoğraflar', body: 'Yüklediğin fotoğraflardaki EXIF bilgileri (konum dahil) saklanmadan önce silinir. Galeriden eklenen eski bir fotoğraf için yalnızca "Galeriden" bilgisi tutulur, çekim zamanı saklanmaz.' },
      { heading: 'Kim neyi görür?', body: 'Sinyallerin herkese açıktır; anonim paylaştığında adın gösterilmez. Hikayelerini yalnızca onaylı takipçilerin görür. Sohbetler ve snap’ler yalnızca iki kişi arasındadır; snap bir kez izlenip silinir.' },
      { heading: 'Saklama ve silme', body: 'Sinyaller süreleri dolunca haritadan kalkar. Hesabını sildiğinde 30 gün sonra hesabın, sinyallerin, yorumların, beğenilerin, hikayelerin, snap’lerin ve yüklediğin medya silinir; sohbetlerde "Silinmiş kullanıcı" görünür.' },
      { heading: 'Hakların', body: `KVKK ve GDPR kapsamında verilerine erişme, düzeltme ve silme hakkın var. Veri kopyası için Ayarlar > Hesap > Verilerimi iste’yi kullan; diğer talepler için ${SUPPORT_EMAIL} adresine yaz.` },
      { heading: 'Üçüncü taraflar', body: 'Verilerini satmıyoruz. Harita altlığı Apple Maps / Google Maps’ten, yer verileri OpenStreetMap’ten gelir.' },
    ],
  },
};

const en: Record<LegalDocId, LegalDoc> = {
  community: {
    title: 'Community guidelines',
    updated: UPDATED,
    sections: [
      { heading: 'What Blinkr is for', body: 'Blinkr is a map where people share fresh, place-bound signals so everyone can decide about a place faster and better. Everything you share should serve that.' },
      { heading: 'Share what is true and current', body: 'Only share what you see or know. Don’t present old photos as "now"; older gallery photos are labelled "From gallery" and never change the live state. Spreading false information on purpose is not allowed.' },
      { heading: 'Respect people', body: 'Threats, harassment, hate speech, targeting and humiliation are not allowed. Don’t share other people’s faces, plates, ID or address without consent. To keep children safe, no photos or videos at schools and kindergartens.' },
      { heading: 'No harmful content', body: 'No nudity, sexual content, violence, content that encourages self-harm, illegal goods or services, or spam. Don’t disguise ads as community signals.' },
      { heading: 'Report and block', body: 'You can report and block any signal, comment, story or person that breaks the rules. Reports are reviewed; serious cases lead to hidden content, restrictions or a closed account.' },
      { heading: 'Sanctions and appeals', body: `A warning, a 24-hour posting limit, a 7-day suspension or a permanent ban may apply. To appeal a decision, write to ${SUPPORT_EMAIL} with your username.` },
    ],
  },
  terms: {
    title: 'Terms of use',
    updated: UPDATED,
    sections: [
      { heading: 'Acceptance', body: 'By using Blinkr you accept these terms and the Community guidelines. If you don’t, please don’t use the app.' },
      { heading: 'Age', body: 'You must be at least 13 to use Blinkr. Accounts under 18 start private and only receive messages from friends.' },
      { heading: 'Your account', body: 'You are responsible for keeping your account safe. Never share your password. You can delete your account at any time in Settings > Account > Delete account; signing in within 30 days cancels it.' },
      { heading: 'Your content', body: 'You own what you share. You give Blinkr a free, non-transferable permission to show, store and process it in the app and for safety. Don’t share content that belongs to someone else.' },
      { heading: 'Nature of the information', body: 'Signals are people’s observations; Blinkr does not guarantee them. For important decisions (health, safety, emergencies) use official sources. In an emergency call 112.' },
      { heading: 'Changes', body: 'Blinkr may improve, change or stop the service. Changes to these terms are announced in the app.' },
      { heading: 'Contact', body: `Questions and appeals: ${SUPPORT_EMAIL}` },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    updated: UPDATED,
    sections: [
      { heading: 'What we collect', body: 'Account: username, email, a hash of your password (never the password), birth year. Content: signals, comments, stories, chat messages and the media you add. Location: only while sharing and for the Nearby/map features, with your device permission.' },
      { heading: 'How your location is used', body: 'Your exact device location is never shown to other people. The map shows the place’s centre or an approximate area. Location is used to verify on the server that a signal was made at the place, and it is not written to logs.' },
      { heading: 'Photos', body: 'EXIF data (including location) is removed from your photos before they are stored. For an older gallery photo only a "From gallery" flag is kept, never the capture time.' },
      { heading: 'Who sees what', body: 'Your signals are public; when you share anonymously your name is not shown. Only approved followers see your stories. Chats and snaps are between two people; a snap is deleted after it is viewed.' },
      { heading: 'Keeping and deleting', body: 'Signals leave the map when they expire. When you delete your account, 30 days later your account, signals, comments, likes, stories, snaps and uploaded media are deleted; chats show "Deleted user".' },
      { heading: 'Your rights', body: `Under KVKK and GDPR you can access, correct and delete your data. For a copy use Settings > Account > Request my data; for anything else write to ${SUPPORT_EMAIL}.` },
      { heading: 'Third parties', body: 'We don’t sell your data. The base map comes from Apple Maps / Google Maps and place data from OpenStreetMap.' },
    ],
  },
};

export const legalDoc = (id: LegalDocId, language: string): LegalDoc => (language === 'en' ? en : tr)[id];
export const draftNote = (language: string) => (language === 'en'
  ? 'This text is a draft and needs legal review before release.'
  : 'Bu metin taslaktır, yayından önce hukuki inceleme gerekir.');
