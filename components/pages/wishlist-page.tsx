"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  FolderInput,
  Gift,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShoppingBag,
  Tag,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DeleteButton } from "@/components/delete-button"
import { useConfirm } from "@/components/confirm-provider"
import { MoreDots } from "@/components/lottie"
import { SegmentedTabs } from "@/components/segmented-tabs"
import { useToast } from "@/hooks/use-toast"
import { useLiveRefresh } from "@/lib/live-sync"
import { cn } from "@/lib/utils"
import {
  COMPARE_SITES,
  CURRENCIES,
  bestOffer,
  formatPrice,
  hostOf,
  priceTrend,
  promoLinks,
  searchQuery,
  type PricePoint,
  type WishlistItem,
  type WishlistList,
} from "@/lib/wishlist/shared"

type Show = "todo" | "bought" | "all"
type Sort = "recent" | "price-asc" | "price-desc"
const ALL = "all"
const NO_LIST = "none"

async function send<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Erreur")
  return data as T
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : undefined)

/** Page Wishlist : listes d'achats avec liens et prix, comparaison entre boutiques et codes promo. */
export function WishlistPage() {
  const { toast } = useToast()
  const askConfirm = useConfirm()
  const [lists, setLists] = useState<WishlistList[]>([])
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [listFilter, setListFilter] = useState<string>(ALL)
  const [show, setShow] = useState<Show>("todo")
  const [sort, setSort] = useState<Sort>("recent")
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<WishlistItem | "new" | null>(null)
  const [comparingId, setComparingId] = useState<string | null>(null)
  const [listDialog, setListDialog] = useState<WishlistList | "new" | null>(null)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set())

  const load = useCallback(
    async (silent = false) => {
      try {
        const data = await send<{ lists: WishlistList[]; items: WishlistItem[] }>("GET", "/api/wishlist")
        setLists(data.lists)
        setItems(data.items)
        setLoaded(true)
      } catch {
        if (!silent) toast({ title: "Wishlist indisponible", description: "Réessaie dans un instant.", variant: "destructive" })
      }
    },
    [toast]
  )
  useEffect(() => {
    load()
  }, [load])
  useLiveRefresh(() => load(true))

  // Liste supprimée ailleurs : retour à « Toutes »
  useEffect(() => {
    if (listFilter !== ALL && listFilter !== NO_LIST && loaded && !lists.some((l) => l.id === listFilter)) setListFilter(ALL)
  }, [lists, listFilter, loaded])

  const fail = (e: unknown) => toast({ title: "Action impossible", description: errorText(e), variant: "destructive" })
  const replaceItem = (item: WishlistItem) => setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))

  const updateItem = async (id: string, patch: Record<string, unknown>) => {
    try {
      replaceItem(await send<WishlistItem>("PUT", "/api/wishlist/items", { id, ...patch }))
    } catch (e) {
      fail(e)
    }
  }

  const refreshOne = async (id: string) => {
    setRefreshing((s) => new Set(s).add(id))
    try {
      const item = await send<WishlistItem>("POST", "/api/wishlist/refresh", { id })
      replaceItem(item)
      toast({ title: item.checkError ? "Prix non relu" : "Prix actualisé", description: item.checkError ?? undefined })
    } catch (e) {
      fail(e)
    } finally {
      setRefreshing((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  const refreshAll = async () => {
    setRefreshingAll(true)
    try {
      const { items: updated } = await send<{ items: WishlistItem[] }>("POST", "/api/wishlist/refresh", { all: true })
      const byId = new Map(updated.map((i) => [i.id, i]))
      setItems((prev) => prev.map((i) => byId.get(i.id) ?? i))
      const failed = updated.filter((i) => i.checkError).length
      toast({
        title: updated.length ? `${updated.length} article${updated.length > 1 ? "s" : ""} actualisé${updated.length > 1 ? "s" : ""}` : "Rien à actualiser",
        description: failed ? `${failed} prix n'ont pas pu être relus (site qui bloque la lecture) : saisis-les à la main.` : undefined,
      })
    } catch (e) {
      fail(e)
    } finally {
      setRefreshingAll(false)
    }
  }

  const deleteItem = async (id: string) => {
    try {
      await send("DELETE", `/api/wishlist/items?id=${id}`)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (e) {
      fail(e)
    }
  }

  const deleteList = async (list: WishlistList) => {
    const count = items.filter((i) => i.listId === list.id).length
    const ok = await askConfirm({
      title: `Supprimer la liste « ${list.name} » ?`,
      description: count ? `Ses ${count} article${count > 1 ? "s" : ""} seront supprimés aussi.` : undefined,
      confirmLabel: "Supprimer",
      destructive: true,
    })
    if (!ok) return
    try {
      await send("DELETE", `/api/wishlist/lists?id=${list.id}`)
      setListFilter(ALL)
      load(true)
    } catch (e) {
      fail(e)
    }
  }

  const inList = useMemo(
    () => items.filter((i) => (listFilter === ALL ? true : listFilter === NO_LIST ? !i.listId : i.listId === listFilter)),
    [items, listFilter]
  )

  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const filtered = inList.filter(
      (i) =>
        (show === "all" || (show === "bought" ? i.purchased : !i.purchased)) &&
        words.every((w) => `${i.title} ${i.store ?? ""} ${i.notes ?? ""}`.toLowerCase().includes(w))
    )
    return filtered.sort((a, b) => {
      if (sort === "recent") return b.createdAt.localeCompare(a.createdAt)
      if (a.price == null) return b.price == null ? 0 : 1
      if (b.price == null) return -1
      return sort === "price-asc" ? a.price - b.price : b.price - a.price
    })
  }, [inList, show, sort, query])

  // Somme des articles affichés (prix × quantité)
  const total = useMemo(
    () => ({
      amount: visible.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0),
      unknown: visible.filter((i) => i.price == null).length,
    }),
    [visible]
  )

  const comparing = comparingId ? items.find((i) => i.id === comparingId) ?? null : null
  const currentList = lists.find((l) => l.id === listFilter)
  const countFor = (id: string) => items.filter((i) => !i.purchased && (id === NO_LIST ? !i.listId : i.listId === id)).length

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Wishlist</h1>
          <p className="text-sm text-muted-foreground">Tes listes d&apos;achats avec liens, prix et codes promo</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshingAll || !items.length}>
            <RefreshCw className={cn("size-4", refreshingAll && "animate-spin")} />
            Actualiser les prix
          </Button>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Ajouter un article
          </Button>
        </div>
      </div>

      {/* Listes */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs
          label="Listes"
          value={listFilter}
          onChange={setListFilter}
          className="max-w-full"
          tabs={[
            { value: ALL, label: "Toutes", badge: items.filter((i) => !i.purchased).length },
            ...lists.map((l) => ({ value: l.id, label: l.name, badge: countFor(l.id) })),
            ...(lists.length && items.some((i) => !i.listId) ? [{ value: NO_LIST, label: "Sans liste", badge: countFor(NO_LIST) }] : []),
          ]}
        />
        <Button variant="outline" size="sm" onClick={() => setListDialog("new")}>
          <Plus className="size-4" />
          Nouvelle liste
        </Button>
        {currentList && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-8" onClick={() => setListDialog(currentList)} aria-label="Renommer la liste">
              <Pencil className="size-4" />
            </Button>
            <DeleteButton label="Supprimer la liste" confirm={false} onDelete={() => deleteList(currentList)} />
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={show} onValueChange={(v) => v && setShow(v as Show)} aria-label="Articles affichés">
          <ToggleGroupItem value="todo">À acheter</ToggleGroupItem>
          <ToggleGroupItem value="bought">Achetés</ToggleGroupItem>
          <ToggleGroupItem value="all">Tout</ToggleGroupItem>
        </ToggleGroup>
        <p className="whitespace-nowrap px-1 text-sm" title={total.unknown ? `${total.unknown} article(s) sans prix non compté(s)` : undefined}>
          <span className="text-muted-foreground">Total </span>
          <span className="font-semibold tabular-nums">{formatPrice(total.amount)}</span>
          {total.unknown > 0 && <span className="text-xs text-muted-foreground"> · {total.unknown} sans prix</span>}
        </p>
        <div className="relative min-w-40 flex-1 @2xl/main:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className="h-8 pl-8" />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger size="sm" className="w-44" aria-label="Trier">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Ajouts récents</SelectItem>
            <SelectItem value="price-asc">Prix croissant</SelectItem>
            <SelectItem value="price-desc">Prix décroissant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Articles */}
      {!loaded ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-14 text-center">
          <Gift className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">{items.length ? "Aucun article ici" : "Ta wishlist est vide"}</p>
            <p className="text-sm text-muted-foreground">
              Colle le lien d&apos;un produit : le titre, l&apos;image et le prix sont récupérés automatiquement.
            </p>
          </div>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Ajouter un article
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 @3xl/main:grid-cols-2 @6xl/main:grid-cols-3">
          {visible.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              lists={lists}
              refreshing={refreshing.has(item.id)}
              onEdit={() => setEditing(item)}
              onCompare={() => setComparingId(item.id)}
              onRefresh={() => refreshOne(item.id)}
              onTogglePurchased={() => updateItem(item.id, { purchased: !item.purchased })}
              onMove={(listId) => updateItem(item.id, { listId })}
              onDelete={() => deleteItem(item.id)}
              onCopied={() => toast({ title: "Code copié" })}
            />
          ))}
        </div>
      )}

      {editing && (
        <ItemDialog
          item={editing === "new" ? null : editing}
          lists={lists}
          defaultListId={currentList?.id ?? null}
          onClose={() => setEditing(null)}
          onSaved={(item, created) => {
            setItems((prev) => (created ? [item, ...prev] : prev.map((i) => (i.id === item.id ? item : i))))
            setEditing(null)
            if (created && item.url && item.price == null) {
              toast({ title: "Article ajouté sans prix", description: item.checkError ?? "Ajoute-le à la main depuis « Modifier »." })
            }
          }}
        />
      )}

      {comparing && (
        <CompareDialog
          item={comparing}
          refreshing={refreshing.has(comparing.id)}
          onClose={() => setComparingId(null)}
          onChange={replaceItem}
          onRefresh={() => refreshOne(comparing.id)}
          onSavePromo={(promoCode) => updateItem(comparing.id, { promoCode })}
        />
      )}

      {listDialog && (
        <ListDialog
          list={listDialog === "new" ? null : listDialog}
          onClose={() => setListDialog(null)}
          onSaved={(list, created) => {
            setLists((prev) => (created ? [...prev, list] : prev.map((l) => (l.id === list.id ? list : l))))
            if (created) setListFilter(list.id)
            setListDialog(null)
          }}
        />
      )}
    </div>
  )
}

function Thumb({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white", className)}>
      {src && !broken ? (
        // Images des boutiques : sans référent (certaines refusent l'affichage depuis un autre site)
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="size-full object-contain" />
      ) : (
        <ShoppingBag className="size-1/3 text-neutral-400" />
      )}
    </div>
  )
}

function ItemCard({
  item,
  lists,
  refreshing,
  onEdit,
  onCompare,
  onRefresh,
  onTogglePurchased,
  onMove,
  onDelete,
  onCopied,
}: {
  item: WishlistItem
  lists: WishlistList[]
  refreshing: boolean
  onEdit: () => void
  onCompare: () => void
  onRefresh: () => void
  onTogglePurchased: () => void
  onMove: (listId: string | null) => void
  onDelete: () => void
  onCopied: () => void
}) {
  const best = bestOffer(item)
  const cheaper = best && !best.main && item.price != null && best.price < item.price ? best : null
  const trend = priceTrend(item.priceHistory, item.price)

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", item.purchased && "opacity-70")}>
      <CardContent className="flex gap-3 p-3">
        <Thumb src={item.imageUrl} alt={item.title} className="size-20 @2xl/main:size-24" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start gap-1">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("line-clamp-2 min-w-0 flex-1 text-sm font-medium hover:underline", item.purchased && "line-through")}
              >
                {item.title}
              </a>
            ) : (
              <p className={cn("line-clamp-2 min-w-0 flex-1 text-sm font-medium", item.purchased && "line-through")}>{item.title}</p>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
                  aria-label={`Actions pour ${item.title}`}
                >
                  <MoreDots />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="size-4" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCompare}>
                  <Scale className="size-4" />
                  Comparer les prix
                </DropdownMenuItem>
                {(item.url || item.offers.length > 0) && (
                  <DropdownMenuItem onClick={onRefresh} disabled={refreshing}>
                    <RefreshCw className="size-4" />
                    Actualiser le prix
                  </DropdownMenuItem>
                )}
                {item.url && (
                  <DropdownMenuItem asChild>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" />
                      Ouvrir le lien
                    </a>
                  </DropdownMenuItem>
                )}
                {lists.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderInput className="size-4" />
                      Déplacer vers
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {lists.map((l) => (
                        <DropdownMenuItem key={l.id} disabled={l.id === item.listId} onClick={() => onMove(l.id)}>
                          {l.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={!item.listId} onClick={() => onMove(null)}>
                        Sans liste
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DeleteButton label="Supprimer l'article" onDelete={onDelete} confirm={{ title: `Supprimer « ${item.title.slice(0, 60)} » ?`, destructive: true }} />
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {item.store && <span className="truncate">{item.store}</span>}
            {item.quantity > 1 && <span>× {item.quantity}</span>}
            {trend != null && (
              <span className={cn("inline-flex items-center gap-0.5", trend < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                {trend < 0 ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}
                {trend > 0 ? "+" : ""}
                {trend} %
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-semibold tabular-nums">{item.price != null ? formatPrice(item.price, item.currency) : "Prix ?"}</span>
          </div>

          {cheaper && (
            <button
              type="button"
              onClick={onCompare}
              className="flex w-full min-w-0 items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-left text-xs text-emerald-700 dark:text-emerald-400"
            >
              <Tag className="size-3.5 shrink-0" />
              <span className="truncate">
                Moins cher sur {cheaper.store || "une autre boutique"} : {formatPrice(cheaper.price, item.currency)} (−
                {formatPrice((item.price as number) - cheaper.price, item.currency)})
              </span>
            </button>
          )}
          {item.promoCode && (
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(item.promoCode as string).then(onCopied, () => undefined)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-dashed px-2 py-0.5 font-mono text-xs"
              title="Copier le code promo"
            >
              <Copy className="size-3 shrink-0" />
              <span className="truncate">{item.promoCode}</span>
            </button>
          )}
          {item.checkError && !item.purchased && <p className="text-xs text-amber-600 dark:text-amber-400">{item.checkError}</p>}

          <div className="flex flex-wrap gap-2 pt-0.5">
            <Button variant="outline" size="sm" onClick={onCompare}>
              <Scale className="size-4" />
              Comparer
            </Button>
            <Button variant={item.purchased ? "default" : "outline"} size="sm" onClick={onTogglePurchased}>
              <Check className="size-4" />
              {item.purchased ? "Acheté" : "Marquer acheté"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Ajout / modification ────────────────────────────────────────────────────

interface Form {
  url: string
  title: string
  price: string
  currency: string
  quantity: string
  listId: string
  promoCode: string
  notes: string
  imageUrl: string
  store: string
}

const amountText = (n: number | null) => (n == null ? "" : String(n).replace(".", ","))

function ItemDialog({
  item,
  lists,
  defaultListId,
  onClose,
  onSaved,
}: {
  item: WishlistItem | null
  lists: WishlistList[]
  defaultListId: string | null
  onClose: () => void
  onSaved: (item: WishlistItem, created: boolean) => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<Form>(() => ({
    url: item?.url ?? "",
    title: item?.title ?? "",
    price: amountText(item?.price ?? null),
    currency: item?.currency ?? "EUR",
    quantity: String(item?.quantity ?? 1),
    listId: item ? item.listId ?? NO_LIST : defaultListId ?? NO_LIST,
    promoCode: item?.promoCode ?? "",
    notes: item?.notes ?? "",
    imageUrl: item?.imageUrl ?? "",
    store: item?.store ?? "",
  }))
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))

  const fetchInfo = async () => {
    if (!form.url.trim()) return
    setFetching(true)
    setFetchError(null)
    try {
      const info = await send<{ title: string | null; price: number | null; currency: string | null; imageUrl: string | null; store: string }>(
        "POST",
        "/api/wishlist/preview",
        { url: form.url.trim() }
      )
      set({
        title: info.title ?? form.title,
        price: info.price != null ? amountText(info.price) : form.price,
        currency: info.currency && (CURRENCIES as readonly string[]).includes(info.currency) ? info.currency : form.currency,
        imageUrl: info.imageUrl ?? form.imageUrl,
        store: info.store || form.store,
      })
      if (info.price == null) setFetchError("Prix introuvable sur la page : saisis-le à la main.")
    } catch (e) {
      setFetchError(errorText(e) ?? "Lecture impossible")
    } finally {
      setFetching(false)
    }
  }

  const save = async () => {
    if (!form.url.trim() && !form.title.trim()) return
    setSaving(true)
    const payload = {
      url: form.url.trim() || null,
      title: form.title.trim() || undefined,
      price: form.price.trim() || null,
      currency: form.currency,
      quantity: form.quantity,
      listId: form.listId === NO_LIST ? null : form.listId,
      promoCode: form.promoCode.trim() || null,
      notes: form.notes.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      store: form.store.trim() || null,
    }
    try {
      const saved = item
        ? await send<WishlistItem>("PUT", "/api/wishlist/items", { id: item.id, ...payload })
        : await send<WishlistItem>("POST", "/api/wishlist/items", payload)
      onSaved(saved, !item)
    } catch (e) {
      toast({ title: "Enregistrement impossible", description: errorText(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Modifier l'article" : "Ajouter un article"}</DialogTitle>
          <DialogDescription>Colle le lien du produit : le reste se remplit tout seul quand le site le permet.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wish-url">Lien du produit</Label>
            <div className="flex gap-2">
              <Input
                id="wish-url"
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={form.url}
                onChange={(e) => set({ url: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), fetchInfo())}
              />
              <Button type="button" variant="outline" onClick={fetchInfo} disabled={fetching || !form.url.trim()} className="shrink-0">
                {fetching ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                Récupérer
              </Button>
            </div>
            {fetchError && <p className="text-xs text-amber-600 dark:text-amber-400">{fetchError}</p>}
          </div>

          <div className="flex gap-3">
            {form.imageUrl && <Thumb src={form.imageUrl} alt="" className="size-16" />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="wish-title">Nom</Label>
              <Input id="wish-title" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Casque audio…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wish-price">Prix</Label>
              <Input id="wish-price" inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} placeholder="0,00 €" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wish-qty">Quantité</Label>
              <Input id="wish-qty" type="number" min={1} max={999} value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Liste</Label>
              <Select value={form.listId} onValueChange={(v) => set({ listId: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LIST}>Sans liste</SelectItem>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wish-promo">Code promo</Label>
              <Input id="wish-promo" value={form.promoCode} onChange={(e) => set({ promoCode: e.target.value })} placeholder="Facultatif" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wish-notes">Notes</Label>
            <Textarea id="wish-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Taille, couleur, idée cadeau…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || (!form.url.trim() && !form.title.trim())}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {item ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Comparaison et codes promo ──────────────────────────────────────────────

function CompareDialog({
  item,
  refreshing,
  onClose,
  onChange,
  onRefresh,
  onSavePromo,
}: {
  item: WishlistItem
  refreshing: boolean
  onClose: () => void
  onChange: (item: WishlistItem) => void
  onRefresh: () => void
  onSavePromo: (code: string | null) => void
}) {
  const { toast } = useToast()
  const [url, setUrl] = useState("")
  const [price, setPrice] = useState("")
  const [adding, setAdding] = useState(false)
  const [promo, setPromo] = useState(item.promoCode ?? "")
  const queryText = searchQuery(item.title)
  const best = bestOffer(item)

  const rows = useMemo(() => {
    const list: { id: string | null; store: string; url: string | null; price: number | null; error: string | null }[] = []
    if (item.url || item.price != null) {
      list.push({ id: null, store: item.store || hostOf(item.url) || "Lien principal", url: item.url, price: item.price, error: item.checkError })
    }
    for (const o of item.offers) list.push({ id: o.id, store: o.store, url: o.url, price: o.currency === item.currency ? o.price : null, error: o.error })
    return list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  }, [item])

  const run = async (fn: () => Promise<WishlistItem>) => {
    try {
      onChange(await fn())
      return true
    } catch (e) {
      toast({ title: "Action impossible", description: errorText(e), variant: "destructive" })
      return false
    }
  }

  const addOffer = async () => {
    if (!url.trim()) return
    setAdding(true)
    const ok = await run(() => send("POST", "/api/wishlist/offers", { itemId: item.id, url: url.trim(), price: price.trim() || undefined }))
    setAdding(false)
    if (ok) {
      setUrl("")
      setPrice("")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="line-clamp-2 pr-6">{item.title}</DialogTitle>
          <DialogDescription>Compare le prix entre boutiques et trouve un code promo.</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Offres suivies</h3>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              Actualiser
            </Button>
          </div>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Aucun prix pour l&apos;instant : ajoute un lien ci-dessous.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {rows.map((row) => (
                <OfferRow
                  key={row.id ?? "main"}
                  row={row}
                  currency={item.currency}
                  isBest={!!best && row.price === best.price}
                  onSetPrice={(value) =>
                    row.id
                      ? run(() => send("PUT", "/api/wishlist/offers", { itemId: item.id, offerId: row.id, price: value }))
                      : run(() => send("PUT", "/api/wishlist/items", { id: item.id, price: value }))
                  }
                  onRemove={row.id ? () => run(() => send("DELETE", `/api/wishlist/offers?itemId=${item.id}&offerId=${row.id}`)) : undefined}
                />
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Input
              type="url"
              inputMode="url"
              placeholder="Lien du même produit sur une autre boutique"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOffer())}
              className="min-w-48 flex-1"
            />
            <Input inputMode="decimal" placeholder="Prix (facultatif)" value={price} onChange={(e) => setPrice(e.target.value)} className="w-36" />
            <Button onClick={addOffer} disabled={adding || !url.trim()}>
              {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Ajouter
            </Button>
          </div>
          {item.priceHistory.length > 1 && <PriceHistory points={item.priceHistory} currency={item.currency} />}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Chercher ailleurs</h3>
          <p className="text-xs text-muted-foreground">
            Recherche « {queryText} » sur d&apos;autres plateformes, puis colle le lien trouvé ci-dessus pour le suivre.
          </p>
          <div className="flex flex-wrap gap-2">
            {COMPARE_SITES.map((site) => (
              <Button key={site.name} variant="outline" size="sm" asChild>
                <a href={site.url(queryText)} target="_blank" rel="noopener noreferrer">
                  {site.name}
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Codes promo</h3>
          <div className="flex flex-wrap gap-2">
            {promoLinks(item.store || hostOf(item.url), item.title).map((link) => (
              <Button key={link.url} variant="outline" size="sm" asChild>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.name}
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Code trouvé (gardé sur la fiche)" className="font-mono" />
            <Button variant="outline" onClick={() => onSavePromo(promo.trim() || null)} disabled={(promo.trim() || null) === item.promoCode}>
              Enregistrer
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  )
}

function OfferRow({
  row,
  currency,
  isBest,
  onSetPrice,
  onRemove,
}: {
  row: { id: string | null; store: string; url: string | null; price: number | null; error: string | null }
  currency: string
  isBest: boolean
  onSetPrice: (value: string | null) => Promise<boolean>
  onRemove?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(amountText(row.price))

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{row.store}</span>
          {row.id === null && <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">principal</span>}
          {isBest && <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">meilleur prix</span>}
        </div>
        {row.error && <p className="truncate text-xs text-amber-600 dark:text-amber-400">{row.error}</p>}
      </div>
      {editing ? (
        <form
          className="flex items-center gap-1"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await onSetPrice(value.trim() || null)) setEditing(false)
          }}
        >
          <Input autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-24" aria-label="Prix" />
          <Button type="submit" size="icon" variant="outline" className="size-8" aria-label="Valider le prix">
            <Check className="size-4" />
          </Button>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold tabular-nums hover:underline" title="Saisir le prix à la main">
          {row.price != null ? formatPrice(row.price, currency) : "Prix ?"}
        </button>
      )}
      <div className="flex items-center gap-1">
        {row.url && (
          <Button variant="outline" size="icon" className="size-8" asChild>
            <a href={row.url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${row.store}`}>
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
        {onRemove && (
          <Button variant="outline" size="icon" className="size-8" onClick={onRemove} aria-label={`Retirer ${row.store}`}>
            <X className="size-4" />
          </Button>
        )}
      </div>
    </li>
  )
}

/** Courbe des prix relevés sur le lien principal. */
function PriceHistory({ points, currency }: { points: PricePoint[]; currency: string }) {
  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1
  const W = 300
  const H = 48
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * W).toFixed(1)},${(H - 4 - ((p.price - min) / span) * (H - 8)).toFixed(1)}`)
    .join(" ")
  const first = new Date(points[0].date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>Historique depuis le {first}</span>
        <span>
          min {formatPrice(min, currency)} · max {formatPrice(max, currency)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-12 w-full text-primary" aria-hidden>
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ─── Listes ──────────────────────────────────────────────────────────────────

function ListDialog({
  list,
  onClose,
  onSaved,
}: {
  list: WishlistList | null
  onClose: () => void
  onSaved: (list: WishlistList, created: boolean) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(list?.name ?? "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const saved = list
        ? await send<WishlistList>("PUT", "/api/wishlist/lists", { id: list.id, name })
        : await send<WishlistList>("POST", "/api/wishlist/lists", { name })
      onSaved(saved, !list)
    } catch (e) {
      toast({ title: "Enregistrement impossible", description: errorText(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{list ? "Modifier la liste" : "Nouvelle liste"}</DialogTitle>
          <DialogDescription>Par exemple : Noël, Maison, High-tech…</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wish-list-name">Nom</Label>
            <Input id="wish-list-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {list ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
