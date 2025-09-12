export type MenuItem = {
	id: number;
	name: string;
	price: number;
	description?: string; // optional
	category: string;
	image_url: string;
    station?: string; // optional: kitchen/prep station name
};

export type OrderItem = {
	id: number;
	menu_item_id: number;
	quantity: number;
	status: string;
};

export type Order = {
	id: number;
	table_id: string;
	name?: string | null;
	order_items: OrderItem[];
	status: string;
	comment?: string | null;
	disc_amt?: number | null;
	disc_pct?: number | null;
	created_at: string;
};
