export type MenuItem = {
	id: number;
	name: string;
	price: number;
	description?: string; // optional
	category: string;
	image_url: string;
};

export type OrderItem = {
	id: number;
	menu_item_id: number;
	quantity: number;
};

export type Order = {
	id: number;
	table_id: string;
	name?: string | null;
	order_items: OrderItem[];
	status: string;
	comment?: string | null;
	created_at: string;
};
