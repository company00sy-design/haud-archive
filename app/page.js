'use client'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase' 
import imageCompression from 'browser-image-compression'

export default function HaudArchiveApp() {
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    manager: '',
    product_name: '',
    color: '',
    tags: [],
    as_note: ''
  })

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
    }
    checkUser()
  }, [])

  // 로그인 함수
  const handleLogin = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('로그인 실패: ' + error.message)
    else setUser(data.user)
  }

  // 로그아웃 함수
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const uploadImages = async (files, folder) => {
    const urls = []
    const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1280, useWebWorker: true }
    for (const file of files) {
      try {
        const compressedFile = await imageCompression(file, options)
        const fileName = `${Date.now()}_${file.name}`
        const { data } = await supabase.storage.from('Photos').upload(`${folder}/${fileName}`, compressedFile)
        if (data) {
          const { data: { publicUrl } } = supabase.storage.from('Photos').getPublicUrl(data.path)
          urls.push(publicUrl)
        }
      } catch (err) { console.error(err) }
    }
    return urls
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) return alert('로그인이 필요합니다.')
    setLoading(true)
    const afterFiles = document.getElementById('after_imgs').files
    const asFiles = document.getElementById('as_imgs').files
    try {
      const afterUrls = await uploadImages(afterFiles, 'after')
      const asUrls = await uploadImages(asFiles, 'as')
      const { error } = await supabase.from('projects').insert([{
        ...formData,
        installer_id: user.id,
        installer_name: user.email,
        after_urls: afterUrls,
        as_urls: asUrls
      }])
      if (error) throw error
      alert('저장 완료!')
      window.location.reload()
    } catch (err) { alert(err.message) }
    finally { setLoading(false) }
  }

  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }))
  }

  // 로그인 전 화면
  if (!user) {
    return (
      <main className="max-w-md mx-auto p-10 bg-white min-h-screen flex flex-col justify-center">
        <h1 className="text-3xl font-black text-blue-900 mb-2">hAUD SYSTEM</h1>
        <p className="mb-8 text-gray-500">기사님 로그인 후 이용 가능합니다.</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="이메일" className="w-full p-4 border rounded-xl" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="비밀번호" className="w-full p-4 border rounded-xl" onChange={e => setPassword(e.target.value)} />
          <button className="w-full bg-blue-900 text-white p-4 rounded-xl font-bold">로그인</button>
        </form>
      </main>
    )
  }

  // 로그인 후 화면 (기존 양식)
  return (
    <main className="max-w-md mx-auto p-6 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-blue-900">hAUD SYSTEM</h1>
        <button onClick={handleLogout} className="text-xs text-gray-400 underline">로그아웃</button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 font-bold text-center">
           접속: {user.email} 기사님
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input type="date" value={formData.work_date} className="border-b p-2" onChange={e => setFormData({...formData, work_date: e.target.value})} />
          <input type="text" placeholder="설계 담당자" className="border-b p-2" onChange={e => setFormData({...formData, manager: e.target.value})} />
        </div>

        <input type="text" placeholder="제품명" className="w-full border-b p-2" onChange={e => setFormData({...formData, product_name: e.target.value})} />
        <input type="text" placeholder="컬러" className="w-full border-b p-2" onChange={e => setFormData({...formData, color: e.target.value})} />

        <div className="flex flex-wrap gap-2">
          {['Blum', 'Hafele', '무몰딩', '로봇청소기장'].map(tag => (
            <button key={tag} type="button" onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-xs ${formData.tags.includes(tag) ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>{tag}</button>
          ))}
        </div>

        <div className="pt-4 border-t">
          <label className="block font-bold mb-2 text-sm">📸 시공 완료 사진</label>
          <input type="file" id="after_imgs" multiple accept="image/*" capture="environment" className="w-full text-xs" />
        </div>

        <div className="bg-red-50 p-4 rounded-xl">
          <label className="block font-bold text-red-700 text-sm mb-2">🛠 AS/특이사항</label>
          <input type="file" id="as_imgs" multiple accept="image/*" capture="environment" className="text-xs mb-2" />
          <textarea placeholder="내용 입력" className="w-full p-2 border rounded text-sm" onChange={e => setFormData({...formData, as_note: e.target.value})} />
        </div>

        <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white p-4 rounded-xl font-bold text-lg shadow-lg">
          {loading ? '전송 중...' : '시공 기록 완료'}
        </button>
      </form>
    </main>
  )
}