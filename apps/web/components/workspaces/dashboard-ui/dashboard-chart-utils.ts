export interface DashboardChartPoint {
  index: number;
  x: number;
}

export function getNearestDashboardPointIndex({
  chartWidth,
  pointerClientX,
  points,
  svgLeft,
  svgWidth
}: {
  chartWidth: number;
  pointerClientX: number;
  points: DashboardChartPoint[];
  svgLeft: number;
  svgWidth: number;
}) {
  if (!points.length || svgWidth <= 0) {
    return null;
  }

  const x = ((pointerClientX - svgLeft) / svgWidth) * chartWidth;
  const nearestPoint = points.reduce((closest, point) =>
    Math.abs(point.x - x) < Math.abs(closest.x - x) ? point : closest
  );

  return nearestPoint.index;
}
