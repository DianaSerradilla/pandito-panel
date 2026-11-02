import { useState, type FormEvent } from 'react'
import type { Topic } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { slugify } from '../../lib/slug.ts'
import { useToast } from '../../components/toast.ts'
import { supabase } from '../../lib/supabase.ts'

function TopicItem({ topic, onSaved }: { topic: Topic; onSaved: () => void }) {
  const [name, setName] = useState(topic.name)
  const [family, setFamily] = useState(topic.family ?? '')
  const [popular, setPopular] = useState(topic.popular)
  const { notify } = useToast()

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const { error } = await supabase
      .from('topics')
      .update({ name: name.trim(), family: family.trim() || null, popular })
      .eq('id', topic.id)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify('Tema guardado.', 'success')
    onSaved()
  }

  return (
    <li className="border-t border-line py-3 first:border-t-0">
      <form onSubmit={save} className="flex flex-wrap items-end gap-3">
        <div className="min-w-44 flex-1">
          <label className="label" htmlFor={`t-name-${topic.id}`}>Nombre</label>
          <input id={`t-name-${topic.id}`} required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-44">
          <label className="label" htmlFor={`t-family-${topic.id}`}>Familia (opcional)</label>
          <input id={`t-family-${topic.id}`} className="input" value={family} onChange={(e) => setFamily(e.target.value)} />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={popular} onChange={(e) => setPopular(e.target.checked)} />
          Popular
        </label>
        <button type="submit" className="btn-quiet">Guardar</button>
        <span className="hint">{topic.slug}</span>
      </form>
    </li>
  )
}

export function TopicsPage() {
  const topics = useRows<Topic>('topics', ['sort_order', 'name'])
  const [name, setName] = useState('')
  const [family, setFamily] = useState('')
  const { notify } = useToast()

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const slug = slugify(name)
    if (!slug) return notify('Escribí un nombre para el tema.', 'error')
    const { error: failure } = await supabase
      .from('topics')
      .insert({ slug, name: name.trim(), family: family.trim() || null, sort_order: topics.rows.length + 1 })
    if (failure) {
      notify(failure.code === '23505' ? 'Ya existe un tema con ese nombre.' : failure.message, 'error')
      return
    }
    notify('Tema creado.', 'success')
    {
      setName('')
      setFamily('')
      topics.reload()
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Temas</h1>
      <p className="hint">
        Los temas agrupan diseños y descargas por intereses. Se asignan desde la ficha de cada diseño y desde Descargas. El
        identificador de URL se genera al crear el tema y no cambia.
      </p>

      <form onSubmit={add} className="card space-y-3" aria-labelledby="new-topic-title">
        <h2 id="new-topic-title" className="text-lg font-semibold">Nuevo tema</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44 flex-1">
            <label className="label" htmlFor="new-topic-name">Nombre</label>
            <input id="new-topic-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-44">
            <label className="label" htmlFor="new-topic-family">Familia (opcional)</label>
            <input id="new-topic-family" className="input" value={family} onChange={(e) => setFamily(e.target.value)} />
          </div>
          <button type="submit" className="btn">Crear tema</button>
        </div>
      </form>

      <section className="card" aria-labelledby="topics-title">
        <h2 id="topics-title" className="mb-2 text-lg font-semibold">Temas cargados</h2>
        {topics.error && <p className="error" role="alert">{topics.error}</p>}
        {!topics.loading && topics.rows.length === 0 && <p className="hint">Todavía no hay temas. Creá el primero arriba.</p>}
        <ul>
          {topics.rows.map((t) => (
            <TopicItem key={t.id + t.name + String(t.family) + String(t.popular)} topic={t} onSaved={topics.reload} />
          ))}
        </ul>
      </section>
    </div>
  )
}
