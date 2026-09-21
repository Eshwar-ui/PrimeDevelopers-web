// Generic add/remove/reorder editor for an array of items, used for every
 // repeatable list in the property detail model (tenants, cards, buildings, ...).
 export default function RepeatableList({
   items,
   onChange,
   makeItem,
   renderItem,
   addLabel = 'Add',
   allowAdd = true,
   allowRemove = true,
   maxItems,
 }) {
   const list = items ?? []

   const update = (i, next) => onChange(list.map((it, idx) => (idx === i ? next : it)))
   const remove = (i) => onChange(list.filter((_, idx) => idx !== i))
   const add = () => onChange([...list, makeItem()])

   return (
     <div className="flex flex-col gap-4">
       {list.map((item, i) => (
         <div key={i} className="relative rounded-xl border border-white/10 bg-black/15 p-4">
           {allowRemove && (
             <button
               type="button"
               onClick={() => remove(i)}
               aria-label="Remove"
               className="absolute right-3 top-3 text-xs font-bold uppercase tracking-wide text-red-400/70 hover:text-red-400"
             >
               Remove
             </button>
           )}
           <div className={allowRemove ? 'pr-16' : ''}>{renderItem(item, (next) => update(i, next), i)}</div>
         </div>
       ))}
       {allowAdd && (maxItems == null || list.length < maxItems) && (
         <button
           type="button"
           onClick={add}
           className="w-fit rounded-full border border-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-bone/70 hover:border-ember hover:text-ember"
         >
           + {addLabel}
         </button>
       )}
     </div>
   )
 }