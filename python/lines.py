from shapely.geometry import LineString, Point, Polygon, MultiPolygon

def chk_lines(line1, line2):
    p1, p2 = map(Point, line2.coords)

    if is_collinear(line1, line2):
        # 同一線上
        if  line1.equals(line2):
            return "同一線上 & 完全一致の線"
        elif line1.touches(p1) or line1.touches(p2):
            return "同一線上 & 線が重ならない"
        else:
            return "同一線上 & 線が重なる"
    elif not line1.intersects(line2):
        # 重ならない
        return "全く重ならない"
    else:
        # 交差
        if line1.touches(p1) or line1.touches(p2):
            return "交差端点で接する"
        elif line1.intersects(p1) or line1.intersects(p2):
            return "1点のみ接する"
        else:
            return "交差"
    

def is_collinear(line1, line2, tol=1e-9):
    """
    2つの線分が同じ直線上にあるかを判定
    """
    (x1, y1), (x2, y2) = line1.coords
    (x3, y3), (x4, y4) = line2.coords

    # 方向ベクトルを計算
    vec1 = (x2 - x1, y2 - y1)
    vec2 = (x4 - x3, y4 - y3)

    # 2つの線分の外積がゼロなら平行
    cross_product = vec1[0] * vec2[1] - vec1[1] * vec2[0]
    if abs(cross_product) > tol:
        return False  # 平行でなければ違う直線

    # 一方の線分の端点が他方の線分上にあるか
    if line1.intersects(line2) or line2.intersects(line1):
        return True

    return False
  

def make_polygon():
    """
    複数の線分から最も外側の線分を利用して多角形を生成
    """
    # 線分データ
    pre_segments = [
        [(0, 2), (4, 2)],
        [(3, 4), (3, 6)],
        [(2, 2), (2, 0)],
        [(2, 0), (5, 0)],
        [(0, 6), (0, 2)],
        [(5, 0), (5, 4)],
        [(5, 4), (3, 4)],
        [(3, 6), (0, 6)],
    ]

    segments = []
    # 交差する線は分割する
    for i, seg1 in enumerate(pre_segments):
        line1 = LineString(seg1)
        segments.append(seg1)
        for j in range(i + 1, len(pre_segments)):
            seg2 = pre_segments[j]
            line2 = LineString(seg2)
            if chk_lines(line1, line2) == "1点のみ接する":
                intersection = line1.intersection(line2)
                if seg1 in segments:
                    segments.remove(seg1)
                start, end = seg1
                new_segments = [
                    [start, (intersection.x, intersection.y)],
                    [(intersection.x, intersection.y), end]
                ]
                segments.extend(new_segments)

    # 隣接リストを作成（線分の接続関係）
    graph = defaultdict(list)
    for start, end in segments:
        graph[start].append(end)
        graph[end].append(start)
    
    # 外周の頂点を取得
    polygon_vertices = find_polygon_path(graph)
    polygon = Polygon(polygon_vertices)


def find_polygon_path(graph):
    """
    外周を作成するパスを構築（順番を並べる）
    """
    # 端点をリスト化
    start = list(graph.keys())[0]  # 適当な始点を選択
    path = []
    stack = [start]
    visited = set()

    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        path.append(node)

        for neighbor in graph[node]:
            if neighbor not in visited:
                stack.append(neighbor)

    # ループが形成される場合、最初と最後の点が一致する
    if path[0] in graph[path[-1]]:
        path.append(path[0])  # ループを閉じる

    return path


line31 = LineString([(0, 0), (4, 4)])
line32 = LineString([(0, 4), (4, 0)])
print("交差 [(0, 0), (4, 4)]、[(0, 4), (4, 0)] :", chk_lines(line31, line32))

line35 = LineString([(1, 1), (5, 1)])
line36 = LineString([(3, 1), (7, 1)])
print("重なる線分 [(1, 1), (5, 1)]、[(3, 1), (7, 1)] :", chk_lines(line35, line36))
