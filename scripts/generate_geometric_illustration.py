#!/usr/bin/env python3
"""Reproduce the supplied geometric illustration as a transparent SVG.

Standard library only. Use --scale 0.8 for a 20% reduction within the
unchanged canvas. Geometry follows the supplied artwork; strokes use the site's red.
"""

import argparse
import math
from pathlib import Path


CANVAS_WIDTH = 800
CANVAS_HEIGHT = 620
STROKE_COLOR = "#a12622"
DISPLAY_STROKE_MULTIPLIER = 1.8


def construct_paths():
    paths = []
    vanishing_point = (716, 274)
    center = (218, 323)
    circle_radius = 100
    rectangle_half_height = 211 * 0.8

    def project(horizontal, vertical, depth):
        perspective_scale = 1 / (1 + depth * 0.54)
        return (
            vanishing_point[0]
            + (center[0] + horizontal - vanishing_point[0]) * perspective_scale,
            vanishing_point[1]
            + (center[1] + vertical - vanishing_point[1]) * perspective_scale,
        )

    corners = [
        (-circle_radius, -rectangle_half_height),
        (circle_radius, -rectangle_half_height),
        (circle_radius, rectangle_half_height),
        (-circle_radius, rectangle_half_height),
    ]
    for horizontal, vertical in [corners[0], corners[1], corners[3], corners[2], (0, 0)]:
        paths.append(([project(horizontal, vertical, 0), vanishing_point], 0.9))

    for depth in [0, 1, 2.5, 4.7, 8.2]:
        circle = [
            project(
                circle_radius * math.cos(index * math.tau / 240),
                circle_radius * math.sin(index * math.tau / 240),
                depth,
            )
            for index in range(241)
        ]
        paths.append((circle, 1.15))
        rectangle = [project(horizontal, vertical, depth) for horizontal, vertical in corners + [corners[0]]]
        paths.append((rectangle, 0.8))
        paths.append(([
            project(0, -rectangle_half_height, depth),
            project(0, rectangle_half_height, depth),
        ], 0.8))
        bottom = project(0, rectangle_half_height, depth)
        paths.append(([bottom, (min(bottom[0] + 96, 705), bottom[1])], 0.75))
    return paths


def render_svg(scale=1.0):
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError("Scale must be finite and positive.")

    paths = construct_paths()
    coordinates = [point for points, _ in paths for point in points]
    center_x = (min(horizontal for horizontal, _ in coordinates) + max(horizontal for horizontal, _ in coordinates)) / 2
    center_y = (min(vertical for _, vertical in coordinates) + max(vertical for _, vertical in coordinates)) / 2
    elements = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS_WIDTH} {CANVAS_HEIGHT}">',
        '<title>Safety–Capability Coupling cover illustration</title>',
        '<desc>Circular sections, shortened rectangular frames, and perspective construction lines.</desc>',
    ]
    elements.append(f'<g fill="none" stroke="{STROKE_COLOR}" stroke-linecap="round" stroke-linejoin="round">')
    for points, stroke_width in paths:
        if scale != 1.0:
            points = [
                (center_x + (horizontal - center_x) * scale, center_y + (vertical - center_y) * scale)
                for horizontal, vertical in points
            ]
        scaled_stroke = stroke_width * scale * DISPLAY_STROKE_MULTIPLIER
        if len(points) == 241:
            circle_center_x = (points[0][0] + points[120][0]) / 2
            circle_center_y = (points[0][1] + points[120][1]) / 2
            radius = abs(points[0][0] - points[120][0]) / 2
            elements.append(
                f'<circle cx="{circle_center_x:.3f}" cy="{circle_center_y:.3f}" '
                f'r="{radius:.3f}" stroke-width="{scaled_stroke:g}"/>'
            )
        else:
            point_list = " ".join(f"{horizontal:.3f},{vertical:.3f}" for horizontal, vertical in points)
            elements.append(f'<polyline points="{point_list}" stroke-width="{scaled_stroke:g}"/>')
    elements.append('</g>')
    elements.append('</svg>')
    return "\n".join(elements) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "public" / "illustrations" / "perspective-construction.svg")
    parser.add_argument("--scale", type=float, default=1.0)
    arguments = parser.parse_args()
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(render_svg(arguments.scale), encoding="utf-8")
    print(arguments.output.resolve())


if __name__ == "__main__":
    main()
