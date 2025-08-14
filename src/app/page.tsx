import MenuCard from '../components/MenuCard'

const menu = [
    { id: 1, name: 'Margherita Pizza', price: 8 },
    { id: 2, name: 'Pepperoni Pizza', price: 10 },
    { id: 3, name: 'Coke', price: 2 },
]

export default function HomePage() {
    return (
        <div className="min-h-screen p-6 flex flex-col items-center">
            <h1 className="text-3xl font-bold mb-6">QR Table Menu</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                {menu.map((item) => (
                    <MenuCard key={item.id} item={item} />
                ))}
            </div>
        </div>
    )
}
