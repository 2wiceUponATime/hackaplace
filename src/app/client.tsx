"use client";

import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { Stage, Layer, Image, Rect } from 'react-konva';
import { canvasHeight, canvasWidth, clamp, ClientEnv, colorToNumber, numberToColor } from '@/lib/utils';
import { Database } from '@/lib/supabase.types';
import { toast, ToastContainer } from 'react-toastify';
import { createBrowserClient } from '@/lib/supabase.client';

export default function Client({ env }: { env: ClientEnv }) {
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [canvas, setCanvas] = useState<OffscreenCanvas | null>(null);
	const [supabaseClient, setSupabaseClient] = useState<ReturnType<typeof createBrowserClient> | null>(null)
	const stageRef = useRef<Konva.Stage>(null);
	const layerRef = useRef<Konva.Layer>(null);
	const cursorRef = useRef<Konva.Rect>(null);
	const colorRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		let supabase = supabaseClient;
		if (!supabase) {
			supabase = createBrowserClient(env);
			setSupabaseClient(supabase);
		}

		const updateSize = () => {
			const headerHeight = document.getElementById("header")?.offsetHeight ?? 0;
			setSize({
				width: window.innerWidth,
				height: window.innerHeight - headerHeight,
			});
		};

		updateSize();
		let ctx: OffscreenCanvasRenderingContext2D | null;
		if (canvas) {
			ctx = canvas.getContext("2d");
		} else {
			const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
			ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.fillStyle = "white";
				ctx.fillRect(0, 0, canvasWidth, canvasHeight);
				supabase
					.from("pixel")
					.select()
					.limit(canvasWidth * canvasHeight)
					.then(result => {
						if (!(result.data && ctx)) return;
						for (const i of result.data) {
							ctx.fillStyle = numberToColor(i.color);
							ctx.fillRect(i.x, i.y, 1, 1);
						}
						setCanvas(canvas);
					});
			}
		}
		window.addEventListener('resize', updateSize);

		const channel = supabase
			.channel("pixel")
			.on<Database["public"]["Tables"]["pixel"]["Row"]>(
				"postgres_changes",
				{ event: "*", schema: "public", table: "pixel" },
				payload => {
					if (!ctx) return;
					if (payload.eventType == "DELETE") return;
					const pixel = payload.new;
					ctx.fillStyle = numberToColor(pixel.color);
					ctx.fillRect(pixel.x, pixel.y, 1, 1);
				}
			)
			.subscribe();

		return () => {
			window.removeEventListener('resize', updateSize);
			channel.unsubscribe();
		};
	}, []);

	const ctx = canvas?.getContext("2d");

	function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
		e.evt.preventDefault();

		const stage = stageRef.current;
		if (!stage) return;
		const oldScale = stage.scaleX();
		const pointer = stage.getPointerPosition();
		if (!pointer) return;

		const mousePointTo = {
			x: (pointer.x - stage.x()) / oldScale,
			y: (pointer.y - stage.y()) / oldScale,
		};

		// how to scale? Zoom in? Or zoom out?
		const delta = e.evt.deltaY;
		let direction = delta > 0 ? 1 : -1;

		// when we zoom on trackpad, e.evt.ctrlKey is true
		// in that case lets revert direction
		if (e.evt.ctrlKey) {
			direction = -direction;
		}

		const scaleBy = 1.01 ** (Math.abs(delta) / 50);
		const newScale = clamp(
			direction > 0 ? oldScale * scaleBy : oldScale / scaleBy,
			0.1,
			100,
		)

		stage.scale({ x: newScale, y: newScale });

		const newPos = {
			x: pointer.x - mousePointTo.x * newScale,
			y: pointer.y - mousePointTo.y * newScale,
		};
		stage.position(newPos);
	}

	async function handleClick() {
		const stage = stageRef.current;
		const layer = layerRef.current;
		const color = colorRef.current?.value;
		if (!(ctx && stage && layer && color)) return;
		const pointer = stage.getRelativePointerPosition();
		if (!pointer) return;
		const pos = {
			x: Math.floor(pointer.x),
			y: Math.floor(pointer.y),
		}
		const response = await fetch("/api/place", {
			method: "POST",
			body: JSON.stringify({
				...pos,
				color: colorToNumber(color),
			}),
		});
		if (response.status == 500) {
			toast("Internal server error");
			return;
		}
		if (response.status != 200) {
			const data = await response.json() as { message: string };
			toast(data.message);
			return;
		}
		ctx.fillStyle = color;
		ctx.fillRect(pos.x, pos.y, 1, 1);
		layer.batchDraw();
	}

	function handleMouseMove() {
		const stage = stageRef.current;
		const layer = layerRef.current;
		const cursor = cursorRef.current;
		if (!(ctx && stage && layer && cursor)) return;
		const pointer = stage.getRelativePointerPosition();
		if (!pointer) return;
		const pos = {
			x: Math.floor(pointer.x),
			y: Math.floor(pointer.y),
		}
		if (pos.x < 0 || pos.y < 0 || pos.x >= canvasWidth || pos.y >= canvasWidth) return;
		cursor.position(pos);
	}

	return (
		<>
			<Stage
				width={size.width}
				height={size.height}
				onWheel={handleWheel}
				onClick={handleClick}
				onMouseMove={handleMouseMove}
				onDragEnd={handleMouseMove}
				ref={stageRef}
				draggable
			>
				<Layer imageSmoothingEnabled={false} ref={layerRef}>
					{ canvas &&
						<Image
							x={0}
							y={0}
							width={canvasWidth}
							height={canvasHeight}
							image={canvas}
						/>
					}
					<Rect
						width={1}
						height={1}
						ref={cursorRef}
						stroke="white"
						strokeWidth={0.1}
						fillEnabled={false}
						globalCompositeOperation="difference"
					/>
				</Layer>
			</Stage>
			<ToastContainer position="bottom-right" />
			<input
				type="color"
				ref={colorRef}
				defaultValue="black"
				style={{
					position: "absolute",
					bottom: 20,
					left: 20,
				}}
			/>
		</>
	);
}
