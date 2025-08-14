type MenuItem = {
    id: number
    name: string
    price: number
}

export default function MenuCard({ item }: { item: MenuItem }) {
    return (
        <div className="bg-white shadow-md rounded-lg p-4 flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-2">{item.name}</h2>
            <p className="text-gray-600 mb-4">${item.price}</p>
            <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                Add to order
            </button>
        </div>
    )
}
