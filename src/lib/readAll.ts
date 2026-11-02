const PAGE = 1000

type Page = PromiseLike<{ data: unknown; error: { message: string } | null }>

/** Reads every row of a query, a page at a time (the API caps one response). */
export async function readAll<T>(build: (from: number, to: number) => Page): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data as T[] | null) ?? []
    all.push(...rows)
    if (rows.length < PAGE) return all
  }
}
