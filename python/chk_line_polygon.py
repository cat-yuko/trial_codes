def chk_line_polygon(polygon, line):
    """
    多角形の内部に線分が存在するかチェック
    """
    p1, p2 = map(Point, line.coords)

    if polygon.covers(line):
        # 線分が多角形の内部または境界
        return True
    elif not polygon.covers(p1) and not polygon.covers(p2):
        # 線分が多角形の外部
        return False
    else:
        # 片方の端点が多角形の内部 又は 境界上
        
        # 多角形の外部の端点
        out_point = p1
        if not polygon.covers(p2):
            out_point = p2            

        # 線分の長さ
        length = Point(p1).distance(Point(p2))
        # 多角形と外部の端点との距離
        distance = distance_to_polygon_edge(polygon, out_point)

        if p1.x!= p2.x and p1.y != p2.y:
            # 斜めの場合
            length_px = abs(p2.x - p1.x)
            length_py = abs(p2.y - p1.y)

            length = length_px
            if length_px > length_py:
                length = length_py
            
            if distance == length:
                return False
            else:
                return True
        else:
            # 上記以外
            if distance == length:
                return False
            else:
                return True
        

def chk_line_polygon2(polygon1, polygon2, line):
    """
    2つの多角形の差分を算出し、差分の内部に線分が存在するかチェック
    polygon1からpolygon2を差し引き
    """
    # 多角形が重なっていない場合
    if not polygon1.intersects(polygon2) or polygon1.touches(polygon2):
        return False
    
    difference = polygon1.difference(polygon2)
        
    polygons = []
    if difference.geom_type == 'MultiPolygon':
        for polygon in difference.geoms:
            polygons.append(polygon)
    elif difference.geom_type == 'Polygon':
        polygons.append(difference)

    for polygon in polygons:
        # 線分が多角形の内部または境界
        if polygon.covers(line):
            return True
        
    return False


def distance_to_polygon_edge(polygon, point):
    """
    多角形と点の距離を算出
    点が内部・線上の場合、距離=0
    点が外部の場合は多角形の最短の辺との距離を算出
    """
    # 内部または境界上の点
    if polygon.covers(point):
        return 0.0
    else:  # 外部の点
        return polygon.boundary.distance(point)



# 多角形の結合・差
# 2つの多角形を定義
poly1 = Polygon([(0, 0), (4, 0), (4, 4), (0, 4)])
poly2 = Polygon([(2, 2), (6, 2), (6, 6), (2, 6)])
# 結合（ユニオン）
merged_poly = poly1.union(poly2)
# 複数の多角形を一括結合
polygons = [poly1, poly2, poly3]
merged_all = unary_union(polygons)
# 重ならない部分を計算
difference1 = poly1.difference(poly2)



# 多角形の内部に線分が存在するか
polygon = Polygon([(0,0), (4,0), (4,4), (0,4)])
line1 = LineString([(0,0), (4,0)])
# 判定
print("Line [(0,0), (4,0)] OK:", chk_line_polygon(polygon, line1))

# 多角形の差分
polygon1 = Polygon([(0, 0), (5, 0), (5, 6), (0, 6)])
polygon2 = Polygon([(0, 2), (2, 2), (2, 0), (5, 0), (5, 4), (3, 4), (3, 6), (0, 6)])
line1 = LineString([(0,0), (0,2)])
# 判定
print("Line [(0,0), (0,2)] OK:", chk_line_polygon2(polygon1, polygon2, line1))
