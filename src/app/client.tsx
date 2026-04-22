"use client";

import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { Stage, Layer, Image, Rect } from 'react-konva';
import { canvasHeight, canvasWidth, clamp, ClientEnv, colorToNumber, getCenter, getDistance, numberToColor, Point, tokenExpirationSec } from '@/lib/utils';
import { Database } from '@/lib/supabase.types';
import { toast, ToastContainer } from 'react-toastify';
import { createBrowserClient } from '@/lib/supabase.client';

Konva.hitOnDragEnabled = true;

declare global {
	interface Window {
		turnstile: {
			render: (el: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => string;
			remove: (widgetId: string) => void;
		};
	}
}

export default function Client({ env }: { env: ClientEnv }) {
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [canvas, setCanvas] = useState<OffscreenCanvas | null>(null);
	const [supabaseClient, setSupabaseClient] = useState<ReturnType<typeof createBrowserClient> | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const stageRef = useRef<Konva.Stage>(null);
	const layerRef = useRef<Konva.Layer>(null);
	const cursorRef = useRef<Konva.Rect>(null);
	const colorRef = useRef<HTMLInputElement>(null);
	const turnstileRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = turnstileRef.current;
		if (!el) return;
		let widgetId: string | undefined;
		const render = () => {
			widgetId = window.turnstile.render(el, {
				sitekey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
				callback: token => {
					!async function() {
						const response = await fetch("/api/verify", {
							method: "POST",
							body: JSON.stringify({
								turnstileToken: token,
							}),
						});
						const data = await response.json() as { token: string };
						setToken(data.token);
						setTimeout(() => turnstile.reset(widgetId), (tokenExpirationSec - 10) * 1000);
					}();
				},
			});
		};
		if (typeof window.turnstile !== "undefined") {
			render();
		} else {
			const script = document.querySelector<HTMLScriptElement>('script[src*="turnstile"]');
			script?.addEventListener("load", render);
			return () => script?.removeEventListener("load", render);
		}
		return () => { if (widgetId) window.turnstile.remove(widgetId); };
	}, []);

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
		function finish() {
			done = true;
			if (spinner) spinner.remove();
		}

		const stage = stageRef.current;
		const layer = layerRef.current;
		const color = colorRef.current?.value;
		if (!(ctx && stage && layer && color)) return;
		if (!token) {
			toast("Complete the CAPTCHA before placing pixels");
			return;
		}
		const pointer = stage.getRelativePointerPosition();
		if (!pointer) return;
		const pos = {
			x: Math.floor(pointer.x),
			y: Math.floor(pointer.y),
		}
		let spinner: Konva.Image;
		let done = false;
		Konva.Image.fromURL("/loading.svg", result => {
			if (done) return;
			spinner = result;
			spinner.globalCompositeOperation("difference");
			spinner.position({
				x: pos.x + 0.5,
				y: pos.y + 0.5,
			});
			spinner.offset({
				x: 0.5,
				y: 0.5,
			})
			spinner.size({
				width: 1,
				height: 1,
			});
			const angularSpeed = 180;
			const anim = new Konva.Animation(frame => {
				const angleDiff = (frame.timeDiff * angularSpeed) / 1000;
				spinner.rotate(angleDiff);
			}, layer);
			layer.add(spinner);
			anim.start();
		})
		const response = await fetch("/api/place", {
			method: "POST",
			body: JSON.stringify({
				...pos,
				color: colorToNumber(color),
				token,
			}),
		});
		if (response.status == 500) {
			toast("Internal server error");
			finish();
			return;
		}
		if (response.status != 200) {
			const data = await response.json() as { message: string };
			toast(data.message);
			finish();
			return;
		}
		ctx.fillStyle = color;
		ctx.fillRect(pos.x, pos.y, 1, 1);
		layer.batchDraw();
		finish();
	}
	
	async function handleTap() {
		const stage = stageRef.current;
		const cursor = cursorRef.current;
		if (!(ctx && stage && cursor)) return;
		const pointer = stage.getRelativePointerPosition();
		if (!pointer) return;
		const pos = {
			x: Math.floor(pointer.x),
			y: Math.floor(pointer.y),
		}
		if (pos.x < 0 || pos.y < 0 || pos.x >= canvasWidth || pos.y >= canvasWidth) return;
		const cursorPos = cursor.position();
		if (pos.x == cursorPos.x && pos.y == cursorPos.y) {
			handleClick();
		} else {
			cursor.position(pos);
		}
	}

	let lastCenter: Point | null = null;
	let lastDist = 0;
	let dragStopped = false;

	function handleTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
		e.evt.preventDefault();
		const touch1 = e.evt.touches[0];
		const touch2 = e.evt.touches[1];

		const stage = stageRef.current;
		if (!stage) return;

		// we need to restore dragging, if it was cancelled by multi-touch
		if (touch1 && !touch2 && !stage.isDragging() && dragStopped) {
			stage.startDrag();
			dragStopped = false;
		}

		if (touch1 && touch2) {
			// if the stage was under Konva's drag&drop
			// we need to stop it, and implement our own pan logic with two pointers
			if (stage.isDragging()) {
				dragStopped = true;
				stage.stopDrag();
			}

			const rect = stage.container().getBoundingClientRect();

			const p1 = {
				x: touch1.clientX - rect.left,
				y: touch1.clientY - rect.top,
			};
			const p2 = {
				x: touch2.clientX - rect.left,
				y: touch2.clientY - rect.top,
			};

			if (!lastCenter) {
				lastCenter = getCenter(p1, p2);
				return;
			}
			const newCenter = getCenter(p1, p2);

			const dist = getDistance(p1, p2);

			if (!lastDist) {
				lastDist = dist;
			}

			// local coordinates of center point
			const pointTo = {
				x: (newCenter.x - stage.x()) / stage.scaleX(),
				y: (newCenter.y - stage.y()) / stage.scaleX(),
			};

			const scale = stage.scaleX() * (dist / lastDist);

			stage.scaleX(scale);
			stage.scaleY(scale);

			// calculate new position of the stage
			const dx = newCenter.x - lastCenter.x;
			const dy = newCenter.y - lastCenter.y;

			const newPos = {
				x: newCenter.x - pointTo.x * scale + dx,
				y: newCenter.y - pointTo.y * scale + dy,
			};

			stage.position(newPos);

			lastDist = dist;
			lastCenter = newCenter;
		}
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
				onTap={handleTap}
				onTouchMove={handleTouchMove}
				onTouchEnd={() => {
					lastDist = 0;
					lastCenter = null;
				}}
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
			<div className="absolute bottom-5 left-5">
				<input
					type="color"
					ref={colorRef}
					defaultValue="black"
				/>
				<div ref={turnstileRef} className="mt-3" />
			</div>
		</>
	);
}
