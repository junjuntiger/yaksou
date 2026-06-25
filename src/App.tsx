import { useState, useRef, useEffect } from 'react'
import './index.css'
import { auth, db, storage } from './firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDoc, serverTimestamp,
} from 'firebase/firestore'
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// ─── Types ───────────────────────────────────────────────
type Category = '薬草' | '花' | '雑草'
type PublicFilter = '全て' | Category

type PlantRecord = {
  id: string
  date: string
  name: string
  category: Category
  region: string
  efficacy: string
  usage: string
  author: string
  authorUid?: string
  comment: string
  emoji: string
  imageUrl?: string
}

type UserProfile = {
  name: string
  address: string
  hobby: string
  skill: string
  email: string
  isAdmin: boolean
}

type UserRecord = {
  id: string
  name: string
  email: string
  isAdmin: boolean
  joinedAt: string
}

type Tab = '撮影' | 'みんなの投稿' | 'マイ手帳' | '管理'
type Screen = 'tabs' | 'detail' | 'form' | 'profile' | 'edit'

// ─── Constants ───────────────────────────────────────────
const APP_NAME = '薬草みっけ'

const AI_MOCK = [
  { name: 'ヨモギ', category: '薬草' as Category, efficacy: '消炎・鎮痛・血行促進', usage: 'お灸の材料、入浴剤として活用できます。', emoji: '🌿' },
  { name: 'タンポポ', category: '花' as Category, efficacy: '消化促進・利尿作用', usage: 'タンポポコーヒーやサラダの食材として。', emoji: '🌼' },
  { name: 'ドクダミ', category: '薬草' as Category, efficacy: '殺菌・解毒・むくみ解消', usage: 'ドクダミ茶にしたり化粧水として使用。', emoji: '🌱' },
  { name: 'スギナ', category: '雑草' as Category, efficacy: '利尿・骨強化', usage: 'スギナ茶として飲用します。', emoji: '🌾' },
]

const TAB_ITEMS: { key: Tab; icon: string; label: string }[] = [
  { key: '撮影', icon: '📷', label: '撮影' },
  { key: 'みんなの投稿', icon: '🌿', label: 'みんなの投稿' },
  { key: 'マイ手帳', icon: '📖', label: 'マイ手帳' },
  { key: '管理', icon: '⚙️', label: '管理' },
]

const CATEGORY_CHIP: Record<Category, string> = {
  '薬草': 'bg-[#E1F5EE] text-[#1D9E75] border-[#1D9E75]',
  '花': 'bg-[#FBEAF0] text-pink-600 border-pink-400',
  '雑草': 'bg-[#EAF3DE] text-lime-700 border-lime-500',
}
const CATEGORY_BORDER_L: Record<Category, string> = {
  '薬草': 'border-l-[#1D9E75]',
  '花': 'border-l-pink-400',
  '雑草': 'border-l-lime-500',
}
const EMOJI_MAP: Record<Category, string> = { '薬草': '🌿', '花': '🌼', '雑草': '🌾' }

const today = () => new Date().toISOString().slice(0, 10)
const randomAI = () => AI_MOCK[Math.floor(Math.random() * AI_MOCK.length)]
const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75] bg-white'

const AUTH_ERROR: Record<string, string> = {
  'auth/user-not-found': 'メールアドレスが登録されていません',
  'auth/wrong-password': 'パスワードが間違っています',
  'auth/invalid-credential': 'メールアドレスまたはパスワードが間違っています',
  'auth/email-already-in-use': 'このメールアドレスはすでに使われています',
  'auth/weak-password': 'パスワードは6文字以上にしてください',
  'auth/invalid-email': 'メールアドレスの形式が正しくありません',
}

// ─── Shared UI ────────────────────────────────────────────
function PlantThumb({ record, size = 'md' }: { record: PlantRecord; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'w-10 h-10 rounded-lg' : 'w-14 h-14 rounded-xl'
  const text = size === 'sm' ? 'text-xl' : 'text-4xl'
  if (record.imageUrl) return <img src={record.imageUrl} alt={record.name} className={`${dims} object-cover flex-shrink-0`} />
  return <span className={`${dims} flex items-center justify-center ${text} flex-shrink-0 bg-gray-50`}>{record.emoji}</span>
}

function CategoryChip({ cat }: { cat: Category }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORY_CHIP[cat]}`}>{cat}</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs text-gray-500 mb-1 block">{label}</label>{children}</div>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 pb-2">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
  )
}

// ─── 共通フィルターバー ───────────────────────────────────
function FilterBar({ query, onQuery, filter, onFilter, placeholder }: {
  query: string; onQuery: (q: string) => void
  filter: PublicFilter; onFilter: (f: PublicFilter) => void
  placeholder: string
}) {
  const FILTERS: PublicFilter[] = ['全て', '薬草', '花', '雑草']
  return (
    <div className="bg-white border-b border-gray-100 flex-shrink-0">
      <div className="flex px-2 pt-2 gap-1">
        {FILTERS.map(f => (
          <button key={f} onClick={() => onFilter(f)}
            className={`flex-1 py-2 text-sm rounded-t-xl transition-colors ${filter === f ? 'bg-[#1D9E75] text-white font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}>
            {f}
          </button>
        ))}
      </div>
      <div className="px-3 pb-2 pt-1.5">
        <input type="text" value={query} onChange={e => onQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#1D9E75]" />
      </div>
    </div>
  )
}

// ─── Login Screen ─────────────────────────────────────────
function LoginScreen({ onLogin }: {
  onLogin: (email: string, password: string, profileData?: Partial<UserProfile>) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [hobby, setHobby] = useState('')
  const [skill, setSkill] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('メールアドレスとパスワードを入力してください'); return }
    if (isRegister && !name) { setError('氏名を入力してください'); return }
    setError('')
    setLoading(true)
    try {
      await onLogin(email, password, isRegister ? { name, address, hobby, skill } : undefined)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || ''
      setError(AUTH_ERROR[code] || 'エラーが発生しました。しばらく後でお試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-[#1D9E75] flex flex-col items-center justify-center py-10 px-6">
          <div className="text-5xl mb-3">🌿</div>
          <h1 className="text-2xl font-bold text-white tracking-wide">{APP_NAME}</h1>
          <p className="text-white/70 text-sm mt-1">薬草・野草・花のアーカイブ</p>
        </div>
        <div className="p-6 overflow-y-auto max-h-[65vh]">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{isRegister ? '新規登録' : 'ログイン'}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">メールアドレス</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@mail.com" className={inputCls} autoComplete="email" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">パスワード</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6文字以上" className={inputCls} autoComplete={isRegister ? 'new-password' : 'current-password'} />
            </div>
            {isRegister && (
              <>
                <hr className="border-gray-100" />
                <p className="text-xs text-gray-400">プロフィール情報（後から変更できます）</p>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">氏名 *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="山田 花子" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">住所</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="例: 東京都渋谷区" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">趣味</label>
                  <input type="text" value={hobby} onChange={e => setHobby(e.target.value)} placeholder="例: 山歩き、料理" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">特技</label>
                  <input type="text" value={skill} onChange={e => setSkill(e.target.value)} placeholder="例: 薬草の見分け方" className={inputCls} />
                </div>
              </>
            )}
            {error && <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-2xl bg-[#1D9E75] text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" />処理中...</>
                : isRegister ? '登録してはじめる' : 'ログイン'
              }
            </button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => { setIsRegister(!isRegister); setError('') }} className="text-sm text-[#1D9E75] underline">
              {isRegister ? 'すでにアカウントをお持ちの方はこちら' : '新規登録はこちら'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Profile Screen ───────────────────────────────────────
function ProfileScreen({ profile, onSave, onBack, onLogout }: {
  profile: UserProfile; onSave: (p: UserProfile) => Promise<void>; onBack: () => void; onLogout: () => void
}) {
  const [form, setForm] = useState<UserProfile>(profile)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const set = (k: keyof UserProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))
  const handleSave = async () => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-[#1D9E75] text-white p-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="text-white text-sm">‹ 戻る</button>
        <h2 className="flex-1 font-bold text-lg">マイプロフィール</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="bg-[#E1F5EE] flex flex-col items-center py-8">
          <div className="w-20 h-20 rounded-full bg-[#1D9E75] flex items-center justify-center text-4xl shadow-md">🌿</div>
          <p className="mt-3 font-bold text-gray-800 text-lg">{form.name || '未設定'}</p>
          <p className="text-xs text-gray-500">{form.email}</p>
          {form.isAdmin && <span className="mt-2 text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-3 py-0.5 font-medium">👑 管理者</span>}
        </div>
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          {([['氏名', '👤', 'name', '山田 花子'], ['住所', '🏠', 'address', '例: 東京都渋谷区'], ['趣味', '🎨', 'hobby', '例: 山歩き、料理'], ['特技', '⭐', 'skill', '例: 薬草の見分け方']] as const).map(([label, icon, key, ph]) => (
            <div key={key}>
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><span>{icon}</span>{label}</label>
              <input type="text" value={form[key] as string} onChange={set(key)} placeholder={ph} className={inputCls} />
            </div>
          ))}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 rounded-2xl bg-[#1D9E75] text-white font-bold disabled:opacity-60">
            {saving ? '保存中...' : saved ? '✓ 保存しました' : 'プロフィールを保存'}
          </button>
          {!confirmLogout
            ? <button onClick={() => setConfirmLogout(true)} className="w-full py-3 rounded-2xl border border-gray-200 text-gray-500 text-sm">ログアウト</button>
            : <div className="border border-red-200 rounded-2xl p-4 space-y-3">
                <p className="text-sm text-center text-gray-600">ログアウトしますか？</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmLogout(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm">キャンセル</button>
                  <button onClick={onLogout} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-bold">ログアウト</button>
                </div>
              </div>
          }
        </div>
      </div>
    </div>
  )
}

// ─── Plant Card ───────────────────────────────────────────
function PlantCard({ record, onTap }: { record: PlantRecord; onTap: () => void }) {
  return (
    <button onClick={onTap}
      className={`w-full text-left bg-white rounded-2xl shadow-sm border-l-4 ${CATEGORY_BORDER_L[record.category]} p-3 flex items-center gap-3 active:scale-[0.98] transition-transform hover:shadow-md`}>
      <PlantThumb record={record} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-gray-800">{record.name}</span>
          <CategoryChip cat={record.category} />
        </div>
        <p className="text-xs text-gray-500 truncate">{record.efficacy}</p>
        <p className="text-xs text-gray-400">{record.region} · {record.date} · {record.author}</p>
      </div>
      <span className="text-gray-300 text-lg flex-shrink-0">›</span>
    </button>
  )
}

// ─── Plant Detail ─────────────────────────────────────────
function PlantDetail({ record, onBack, onEdit }: {
  record: PlantRecord; onBack: () => void; onEdit?: () => void
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-[#1D9E75] text-white p-4 relative flex-shrink-0">
        <button onClick={onBack} className="absolute left-4 top-4 text-white text-sm">‹ 戻る</button>
        <div className="text-center pt-1">
          <h1 className="text-xl font-bold">{record.name}</h1>
          <div className="flex justify-center mt-1"><CategoryChip cat={record.category} /></div>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="absolute right-4 top-4 bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-xl">修正</button>
        )}
      </div>
      {record.imageUrl
        ? <img src={record.imageUrl} alt={record.name} className="w-full h-52 object-cover flex-shrink-0" />
        : <div className="w-full h-36 bg-[#E1F5EE] flex items-center justify-center text-7xl flex-shrink-0">{record.emoji}</div>
      }
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto w-full">
        <InfoRow label="撮影日" value={record.date} />
        <InfoRow label="地域" value={record.region} />
        <InfoRow label="撮影者" value={record.author} />
        <div><p className="text-xs text-gray-400 mb-1">効能</p><p className="text-gray-800">{record.efficacy}</p></div>
        <div><p className="text-xs text-gray-400 mb-1">使い方</p><p className="text-gray-800">{record.usage}</p></div>
        {record.comment && <div><p className="text-xs text-gray-400 mb-1">コメント</p><p className="text-gray-800 bg-gray-50 rounded-xl p-3">{record.comment}</p></div>}
      </div>
    </div>
  )
}

// ─── Camera Screen ────────────────────────────────────────
function CameraScreen({ onFormReady }: {
  onFormReady: (ai: typeof AI_MOCK[0], previewUrl: string, file: File) => void
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }
  const handleScan = () => {
    if (!previewUrl || !file) return
    setScanning(true)
    setTimeout(() => { setScanning(false); onFormReady(randomAI(), previewUrl, file) }, 3000)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-6">
      <h2 className="text-xl font-bold text-gray-800">植物を撮影する</h2>
      <div onClick={() => inputRef.current?.click()}
        className="w-full aspect-square max-w-sm rounded-3xl border-2 border-dashed border-[#1D9E75] flex items-center justify-center overflow-hidden cursor-pointer bg-gray-50">
        {previewUrl
          ? <img src={previewUrl} alt="撮影した植物" className="w-full h-full object-cover" />
          : <div className="text-center text-gray-400"><div className="text-6xl mb-3">📷</div><p className="text-sm">タップして写真を選択</p></div>
        }
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <button onClick={() => inputRef.current?.click()} className="w-full max-w-sm py-3 rounded-2xl border-2 border-[#1D9E75] text-[#1D9E75] font-semibold">
        📷 カメラで撮影 / 写真を選択
      </button>
      {previewUrl && (
        <button onClick={handleScan} disabled={scanning}
          className="w-full max-w-sm py-3 rounded-2xl bg-[#1D9E75] text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
          {scanning ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" />AI解析中...</> : '🔍 AIで調べる'}
        </button>
      )}
    </div>
  )
}

// ─── Detail Form ──────────────────────────────────────────
type FormData = Omit<PlantRecord, 'id'>

function DetailForm({ initial, previewUrl, authorDefault, onSave, onCancel }: {
  initial: Partial<FormData>; previewUrl?: string; authorDefault?: string
  onSave: (data: FormData) => Promise<void>; onCancel: () => void
}) {
  const [form, setForm] = useState<FormData>({
    date: today(), name: '', category: '薬草', region: '',
    efficacy: '', usage: '', author: authorDefault ?? '',
    comment: '', emoji: '🌿', ...initial,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))
  const CATEGORIES: Category[] = ['薬草', '花', '雑草']
  const handleCategoryChange = (cat: Category) => setForm(prev => ({ ...prev, category: cat, emoji: EMOJI_MAP[cat] }))
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.region) return
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (err) {
      console.error(err)
      setError('保存に失敗しました。もう一度お試しください。')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-[#1D9E75] text-white p-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onCancel} className="text-white text-sm">‹ 戻る</button>
        <h2 className="flex-1 text-center font-bold text-lg">詳細入力</h2>
      </div>
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full">
        {previewUrl && <img src={previewUrl} alt="" className="w-full h-44 object-cover rounded-2xl" />}
        <Field label="撮影日"><input type="date" value={form.date} onChange={set('date')} className={inputCls} /></Field>
        <Field label="氏名 *"><input type="text" value={form.author} onChange={set('author')} placeholder="例: 山田 花子" className={inputCls} required /></Field>
        <Field label="地域 *"><input type="text" value={form.region} onChange={set('region')} placeholder="例: 東京都" className={inputCls} required /></Field>
        <Field label="植物名 *"><input type="text" value={form.name} onChange={set('name')} placeholder="例: ヨモギ" className={inputCls} required /></Field>
        <Field label="カテゴリ">
          <div className="flex gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat} type="button" onClick={() => handleCategoryChange(cat)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${form.category === cat ? CATEGORY_CHIP[cat] + ' border-current' : 'border-gray-200 text-gray-500'}`}>
                {cat}
              </button>
            ))}
          </div>
        </Field>
        <Field label="効能"><input type="text" value={form.efficacy} onChange={set('efficacy')} placeholder="例: 消炎・鎮痛" className={inputCls} /></Field>
        <Field label="使い方"><textarea value={form.usage} onChange={set('usage')} placeholder="使い方を入力..." rows={3} className={inputCls + ' resize-none'} /></Field>
        <Field label="コメント"><textarea value={form.comment} onChange={set('comment')} placeholder="コメントを入力..." rows={3} className={inputCls + ' resize-none'} /></Field>
        {error && <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        <button type="submit" disabled={saving}
          className="w-full py-4 rounded-2xl bg-[#1D9E75] text-white font-bold text-lg disabled:opacity-60">
          {saving ? '保存中...' : '保存する'}
        </button>
      </form>
    </div>
  )
}

// ─── Public List ──────────────────────────────────────────
function PublicList({ records, onTap }: { records: PlantRecord[]; onTap: (r: PlantRecord) => void }) {
  const [filter, setFilter] = useState<PublicFilter>('全て')
  const [searchQ, setSearchQ] = useState('')
  const filtered = records.filter(r =>
    (filter === '全て' || r.category === filter) &&
    (r.name.includes(searchQ) || r.region.includes(searchQ) || r.author.includes(searchQ))
  )
  return (
    <div className="flex flex-col h-full">
      <FilterBar query={searchQ} onQuery={setSearchQ} filter={filter} onFilter={setFilter} placeholder="🔍 植物名・地域・撮影者で検索..." />
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0
          ? <p className="text-center text-gray-400 mt-20">投稿がありません</p>
          : <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filtered.map(r => <PlantCard key={r.id} record={r} onTap={() => onTap(r)} />)}
            </div>
        }
      </div>
    </div>
  )
}

// ─── My Book ─────────────────────────────────────────────
function MyBook({ records, onTap }: { records: PlantRecord[]; onTap: (r: PlantRecord) => void }) {
  const [filter, setFilter] = useState<PublicFilter>('全て')
  const [searchQ, setSearchQ] = useState('')
  const filtered = records.filter(r =>
    (filter === '全て' || r.category === filter) &&
    (r.name.includes(searchQ) || r.region.includes(searchQ))
  )
  return (
    <div className="flex flex-col h-full">
      <FilterBar query={searchQ} onQuery={setSearchQ} filter={filter} onFilter={setFilter} placeholder="🔍 植物名・地域で検索..." />
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0
          ? <p className="text-center text-gray-400 mt-20">記録がありません</p>
          : <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filtered.map(r => <PlantCard key={r.id} record={r} onTap={() => onTap(r)} />)}
            </div>
        }
      </div>
    </div>
  )
}

// ─── Edit Form ────────────────────────────────────────────
function EditForm({ record, onSave, onCancel }: {
  record: PlantRecord; onSave: (data: Omit<PlantRecord, 'id'>) => void; onCancel: () => void
}) {
  const [form, setForm] = useState<Omit<PlantRecord, 'id'>>({ ...record })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))
  const CATEGORIES: Category[] = ['薬草', '花', '雑草']
  return (
    <div className="p-4 space-y-4">
      <Field label="氏名"><input type="text" value={form.author} onChange={set('author')} className={inputCls} /></Field>
      <Field label="植物名"><input type="text" value={form.name} onChange={set('name')} className={inputCls} /></Field>
      <Field label="カテゴリ">
        <div className="flex gap-2">
          {CATEGORIES.map(cat => (
            <button key={cat} type="button" onClick={() => setForm(prev => ({ ...prev, category: cat }))}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border ${form.category === cat ? CATEGORY_CHIP[cat] : 'border-gray-200 text-gray-500'}`}>
              {cat}
            </button>
          ))}
        </div>
      </Field>
      <Field label="地域"><input type="text" value={form.region} onChange={set('region')} className={inputCls} /></Field>
      <Field label="効能"><input type="text" value={form.efficacy} onChange={set('efficacy')} className={inputCls} /></Field>
      <Field label="使い方"><textarea value={form.usage} onChange={set('usage')} rows={3} className={inputCls + ' resize-none'} /></Field>
      <Field label="コメント"><textarea value={form.comment} onChange={set('comment')} rows={2} className={inputCls + ' resize-none'} /></Field>
      <div className="flex gap-3 pb-4">
        <button onClick={onCancel} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500">キャンセル</button>
        <button onClick={() => onSave(form)} className="flex-1 py-3 rounded-2xl bg-[#1D9E75] text-white font-bold">保存</button>
      </div>
    </div>
  )
}

// ─── Admin Dashboard ─────────────────────────────────────
function AdminDashboard({ records, users, isAdmin, currentEmail, onUpdate, onDelete, onToggleAdmin }: {
  records: PlantRecord[]
  users: UserRecord[]
  isAdmin: boolean
  currentEmail: string
  onUpdate: (r: PlantRecord) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onToggleAdmin: (userId: string, current: boolean) => Promise<void>
}) {
  const [adminTab, setAdminTab] = useState<'stats' | 'users' | 'plants'>('stats')
  const [statFilter, setStatFilter] = useState<PublicFilter>('全て')
  const [regionFilter, setRegionFilter] = useState('')
  const [catFilter, setCatFilter] = useState<Category | ''>('')
  const [editing, setEditing] = useState<PlantRecord | null>(null)

  const filtered = records.filter(r =>
    r.region.includes(regionFilter) && (catFilter ? r.category === catFilter : true)
  )
  const handleSave = async (data: Omit<PlantRecord, 'id'>) => {
    if (!editing) return
    await onUpdate({ ...data, id: editing.id })
    setEditing(null)
  }

  const total = records.length
  const counts: Record<Category, number> = { '薬草': 0, '花': 0, '雑草': 0 }
  records.forEach(r => counts[r.category]++)
  const regions = [...new Set(records.map(r => r.region))].slice(0, 8)

  const ADMIN_TABS = isAdmin
    ? [{ key: 'stats', label: '📊 統計' }, { key: 'users', label: '👥 登録者' }, { key: 'plants', label: '🛠 投稿管理' }]
    : [{ key: 'stats', label: '📊 統計' }]

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-100 flex-shrink-0 px-3 pt-2 flex gap-2">
        {ADMIN_TABS.map(t => (
          <button key={t.key} onClick={() => setAdminTab(t.key as typeof adminTab)}
            className={`px-3 py-1.5 rounded-t-xl text-sm font-medium transition-colors ${adminTab === t.key ? 'bg-[#1D9E75] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
        {isAdmin && <span className="ml-auto self-center text-xs bg-amber-100 text-amber-600 rounded-full px-2 py-0.5">👑 管理者</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ─ 統計タブ ─ */}
        {adminTab === 'stats' && (
          <>
            <div className="bg-[#1D9E75] text-white rounded-2xl p-3 flex items-center gap-3">
              <span className="text-base font-bold">{total} 件の記録</span>
              <span className="text-xs opacity-70">· {APP_NAME} 総データ数</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['薬草', '花', '雑草'] as Category[]).map(cat => (
                <button key={cat} onClick={() => setStatFilter(statFilter === cat ? '全て' : cat as PublicFilter)}
                  className={`rounded-2xl p-3 text-center border transition-all ${CATEGORY_CHIP[cat]} ${statFilter === cat ? 'ring-2 ring-current ring-offset-1' : 'opacity-80 hover:opacity-100'}`}>
                  <p className="text-base font-bold">{counts[cat]}</p>
                  <p className="text-xs mt-0.5">{cat}</p>
                </button>
              ))}
            </div>
            {regions.length > 0 && (
              <div className="bg-white rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-2">📍 登録地域</p>
                <div className="flex flex-wrap gap-1.5">
                  {regions.map(r => <span key={r} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{r}</span>)}
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400">🕐 {statFilter === '全て' ? '最近の投稿' : `${statFilter}の投稿`}</p>
                {statFilter !== '全て' && (
                  <button onClick={() => setStatFilter('全て')} className="text-xs text-gray-400 hover:text-gray-600">すべて表示</button>
                )}
              </div>
              <div className="space-y-2">
                {(statFilter === '全て' ? records : records.filter(r => r.category === statFilter)).slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <PlantThumb record={r} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-700">{r.name}</span>
                      <span className="text-gray-400 text-xs ml-2">{r.region} · {r.date}</span>
                    </div>
                    <CategoryChip cat={r.category} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ─ 登録者一覧タブ ─ */}
        {adminTab === 'users' && isAdmin && (
          <>
            <p className="text-sm text-gray-500">{users.length}名が登録中</p>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${u.isAdmin ? 'bg-amber-400' : 'bg-[#1D9E75]/60'}`}>
                    {u.isAdmin ? '👑' : (u.name?.[0] || u.email[0].toUpperCase())}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.name || '未設定'}</p>
                      {u.isAdmin && <span className="text-xs bg-amber-100 text-amber-600 rounded-full px-1.5 py-0.5 flex-shrink-0">管理者</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{u.email} · {u.joinedAt}</p>
                  </div>
                  {u.email !== currentEmail ? (
                    <button onClick={() => onToggleAdmin(u.id, u.isAdmin)}
                      className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-xl border font-medium transition-colors ${
                        u.isAdmin ? 'border-amber-300 text-amber-600 hover:bg-amber-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>
                      {u.isAdmin ? '解除' : '管理者に'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-300 flex-shrink-0">あなた</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ─ 投稿管理タブ ─ */}
        {adminTab === 'plants' && isAdmin && (
          <>
            <div className="bg-white rounded-2xl p-3 space-y-2">
              <input type="text" value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                placeholder="🗾 地域で絞り込み..."
                className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#1D9E75]" />
              <div className="flex gap-2">
                {(['', '薬草', '花', '雑草'] as const).map(c => (
                  <button key={c} onClick={() => setCatFilter(c as Category | '')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-colors ${catFilter === c ? 'bg-[#1D9E75] text-white border-[#1D9E75]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {c || '全て'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {filtered.map(r => (
                <div key={r.id} className={`bg-white rounded-2xl border-l-4 ${CATEGORY_BORDER_L[r.category]} p-3 shadow-sm`}>
                  <div className="flex items-center gap-2">
                    <PlantThumb record={r} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-800 text-sm">{r.name}</span>
                        <CategoryChip cat={r.category} />
                      </div>
                      <p className="text-xs text-gray-400 truncate">{r.region} · {r.date} · {r.author}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setEditing(r)}
                        className="px-2.5 py-1 rounded-lg border border-[#1D9E75] text-[#1D9E75] text-xs font-medium hover:bg-[#E1F5EE]">
                        修正
                      </button>
                      <button onClick={() => { if (window.confirm(`「${r.name}」を削除しますか？`)) onDelete(r.id) }}
                        className="px-2.5 py-1 rounded-lg border border-red-400 text-red-500 text-xs font-medium hover:bg-red-50">
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center">
          <div className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">投稿を修正</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <EditForm record={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────
export default function App() {
  const [authLoading, setAuthLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [currentUid, setCurrentUid] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile>({ name: '', address: '', hobby: '', skill: '', email: '', isAdmin: false })
  const [users, setUsers] = useState<UserRecord[]>([])
  const [records, setRecords] = useState<PlantRecord[]>([])
  const [tab, setTab] = useState<Tab>('みんなの投稿')
  const [screen, setScreen] = useState<Screen>('tabs')
  const [selectedRecord, setSelectedRecord] = useState<PlantRecord | null>(null)
  const [pendingAI, setPendingAI] = useState<typeof AI_MOCK[0] | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string>('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // ─ Auth state listener
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUid(user.uid)
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile)
        }
        setLoggedIn(true)
      } else {
        setCurrentUid(null)
        setLoggedIn(false)
        setProfile({ name: '', address: '', hobby: '', skill: '', email: '', isAdmin: false })
      }
      setAuthLoading(false)
    })
  }, [])

  // ─ Records real-time listener
  useEffect(() => {
    if (!loggedIn) { setRecords([]); return }
    const q = query(collection(db, 'records'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlantRecord)))
    })
  }, [loggedIn])

  // ─ Users real-time listener (admin only)
  useEffect(() => {
    if (!profile.isAdmin) { setUsers([]); return }
    return onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRecord)))
    })
  }, [profile.isAdmin])

  // ─ Login / Register
  const handleLogin = async (email: string, password: string, profileData?: Partial<UserProfile>) => {
    if (profileData) {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const userDoc: UserProfile & { joinedAt: string } = {
        name: profileData.name || '',
        address: profileData.address || '',
        hobby: profileData.hobby || '',
        skill: profileData.skill || '',
        email,
        isAdmin: false,
        joinedAt: today(),
      }
      await setDoc(doc(db, 'users', cred.user.uid), userDoc)
    } else {
      await signInWithEmailAndPassword(auth, email, password)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    setScreen('tabs')
    setTab('みんなの投稿')
  }

  // ─ Profile save
  const handleProfileSave = async (p: UserProfile) => {
    if (!currentUid) return
    await updateDoc(doc(db, 'users', currentUid), { ...p })
    setProfile(p)
  }

  // ─ Admin toggle
  const handleToggleAdmin = async (userId: string, current: boolean) => {
    await updateDoc(doc(db, 'users', userId), { isAdmin: !current })
  }

  // ─ Records CRUD
  const handleFormSave = async (data: FormData) => {
    // Storage (Blaze プラン) が有効になるまで画像保存はスキップ
    const imageUrl: string | undefined = undefined
    const record = {
      date: data.date,
      name: data.name,
      category: data.category,
      region: data.region,
      efficacy: data.efficacy || '',
      usage: data.usage || '',
      author: data.author,
      comment: data.comment || '',
      emoji: data.emoji,
      imageUrl: imageUrl ?? null,
      authorUid: currentUid ?? null,
      createdAt: serverTimestamp(),
    }
    await addDoc(collection(db, 'records'), record)
    setScreen('tabs')
    setTab('マイ手帳')
    setPendingAI(null)
    setPendingPreview('')
    setPendingFile(null)
  }

  const updateRecord = async (r: PlantRecord) => {
    const { id, ...data } = r
    await updateDoc(doc(db, 'records', id), data)
    setSelectedRecord(r)
  }

  const deleteRecord = async (id: string) => {
    await deleteDoc(doc(db, 'records', id))
  }

  // ─ Navigation
  const showDetail = (r: PlantRecord) => { setSelectedRecord(r); setScreen('detail') }
  const handleAIReady = (ai: typeof AI_MOCK[0], previewUrl: string, file: File) => {
    setPendingAI(ai); setPendingPreview(previewUrl); setPendingFile(file); setScreen('form')
  }
  const goTab = (key: Tab) => { setTab(key); setScreen('tabs') }

  // ─ Loading splash
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-[#1D9E75] flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🌿</div>
        <p className="text-white text-xl font-bold">{APP_NAME}</p>
        <span className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full inline-block mt-4" />
      </div>
    )
  }

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />

  const renderContent = () => {
    if (screen === 'profile') return (
      <ProfileScreen profile={profile} onSave={handleProfileSave} onBack={() => setScreen('tabs')} onLogout={handleLogout} />
    )
    if (screen === 'edit' && selectedRecord) return (
      <div className="flex flex-col h-full bg-white">
        <div className="bg-[#1D9E75] text-white p-4 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setScreen('detail')} className="text-white text-sm">‹ 戻る</button>
          <h2 className="flex-1 font-bold text-lg">投稿を修正</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <EditForm record={selectedRecord} onSave={async (data) => { await updateRecord({ ...data, id: selectedRecord.id }); setScreen('detail') }} onCancel={() => setScreen('detail')} />
        </div>
      </div>
    )
    if (screen === 'detail' && selectedRecord) return (
      <PlantDetail
        record={selectedRecord}
        onBack={() => setScreen('tabs')}
        onEdit={tab === 'マイ手帳' ? () => setScreen('edit') : undefined}
      />
    )
    if (screen === 'form') return (
      <DetailForm
        initial={pendingAI ? { name: pendingAI.name, category: pendingAI.category, efficacy: pendingAI.efficacy, usage: pendingAI.usage, emoji: pendingAI.emoji, date: today(), region: '', comment: '' } : {}}
        previewUrl={pendingPreview || undefined}
        authorDefault={profile.name}
        onSave={handleFormSave}
        onCancel={() => setScreen('tabs')}
      />
    )
    if (tab === '撮影') return <CameraScreen onFormReady={handleAIReady} />
    if (tab === 'みんなの投稿') return <PublicList records={records} onTap={showDetail} />
    if (tab === 'マイ手帳') return <MyBook records={records} onTap={showDetail} />
    if (tab === '管理') return (
      <AdminDashboard
        records={records} users={users}
        isAdmin={profile.isAdmin} currentEmail={profile.email}
        onUpdate={updateRecord} onDelete={deleteRecord}
        onToggleAdmin={handleToggleAdmin}
      />
    )
  }

  const isOnTab = screen === 'tabs'

  return (
    <div className="fixed inset-0 max-w-[390px] mx-auto flex flex-col bg-gray-50
                    md:static md:inset-auto md:max-w-none md:w-full md:h-screen">
      <header className="bg-[#1D9E75] text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h1 className="text-lg font-bold tracking-wide">🌿 {APP_NAME}</h1>
        <button onClick={() => setScreen('profile')}
          className="md:hidden flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
          <span>👤</span>
          <span className="text-xs font-medium max-w-[80px] truncate">{profile.name || profile.email.split('@')[0]}</span>
        </button>
        <div className="hidden md:flex items-center gap-3">
          {profile.isAdmin && <span className="text-xs bg-amber-400 text-amber-900 rounded-full px-2 py-0.5 font-bold">👑 管理者</span>}
          <span className="text-sm opacity-75">{records.length}件の記録</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 flex-shrink-0">
          <button onClick={() => setScreen('profile')}
            className={`p-4 border-b border-gray-100 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${screen === 'profile' ? 'bg-[#E1F5EE]' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${profile.isAdmin ? 'bg-amber-400' : 'bg-[#1D9E75]'}`}>
              {profile.isAdmin ? '👑' : '🌿'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-800 text-sm truncate">{profile.name || 'ゲスト'}</p>
              <p className="text-xs text-gray-400 truncate">{profile.email}</p>
            </div>
          </button>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {TAB_ITEMS.map(({ key, icon, label }) => (
              <button key={key} onClick={() => goTab(key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isOnTab && tab === key ? 'bg-[#E1F5EE] text-[#1D9E75]' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <span className="text-xl">{icon}</span>
                {label}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-gray-100">
            <button onClick={handleLogout}
              className="w-full py-2 text-sm text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors">
              ログアウト
            </button>
          </div>
        </aside>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {renderContent()}
        </div>
      </div>

      <nav className={`md:hidden bg-white border-t border-gray-200 flex flex-shrink-0 ${!isOnTab ? 'hidden' : ''}`}>
        {TAB_ITEMS.map(({ key, icon, label }) => (
          <button key={key} onClick={() => goTab(key)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
              isOnTab && tab === key ? 'text-[#1D9E75]' : 'text-gray-400'
            }`}>
            <span className="text-xl">{icon}</span>
            <span className="text-[10px] font-medium">{label}</span>
            {isOnTab && tab === key && <span className="w-1 h-1 rounded-full bg-[#1D9E75]" />}
          </button>
        ))}
      </nav>
    </div>
  )
}
