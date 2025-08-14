declare module "qrcode.react" {
	import { ComponentType, SVGProps } from "react";

	interface QRCodeProps extends SVGProps<SVGSVGElement> {
		value: string;
		size?: number;
		bgColor?: string;
		fgColor?: string;
		level?: "L" | "M" | "Q" | "H";
		includeMargin?: boolean;
	}

	const QRCode: ComponentType<QRCodeProps>;
	export default QRCode;
}
