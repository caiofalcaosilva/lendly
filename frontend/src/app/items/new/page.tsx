import ItemForm from '@/components/items/ItemForm'

export default function NewItemPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Anunciar item</h1>
        <p className="text-gray-500 text-sm mt-1">
          Compartilhe um item com seus vizinhos
        </p>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <ItemForm />
      </div>
    </div>
  )
}
