import type { Topic } from '../data/types.ts'
import { useRows } from '../data/useRows.ts'
import { supabase } from '../lib/supabase.ts'
import { useToast } from './toast.ts'

interface Props {
  /** Join table and the column that points at the owner (product or download). */
  table: 'product_topics' | 'download_topics'
  ownerColumn: 'product_id' | 'download_id'
  ownerId: string
}

/** Checkbox list that adds or removes the links between one item and the topics. Each click saves. */
export function TopicPicker({ table, ownerColumn, ownerId }: Props) {
  const topics = useRows<Topic>('topics', ['sort_order', 'name'])
  const links = useRows<Record<string, string>>(table)
  const { notify } = useToast()
  const linked = new Set(links.rows.filter((l) => l[ownerColumn] === ownerId).map((l) => l.topic_id))

  async function toggle(topicId: string, on: boolean) {
    if (!supabase) return
    const { error: failure } = on
      ? await supabase.from(table).insert({ [ownerColumn]: ownerId, topic_id: topicId })
      : await supabase.from(table).delete().eq(ownerColumn, ownerId).eq('topic_id', topicId)
    if (failure) notify(failure.message, 'error')
    links.reload()
  }

  if (!topics.loading && topics.rows.length === 0) return <p className="hint">Todavía no hay temas. Creálos en la sección Temas.</p>
  return (
    <fieldset>
      <legend className="label">Temas</legend>
      <div className="flex flex-wrap gap-x-5">
        {topics.rows.map((t) => (
          <label key={t.id} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={linked.has(t.id)} onChange={(e) => void toggle(t.id, e.target.checked)} />
            {t.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
