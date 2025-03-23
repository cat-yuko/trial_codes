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


def chk_distance():

    poly = Polygon([(1, 1), (5, 1), (5, 5), (1, 5), (1, 3), (3, 3), (3, 2), (1, 2), (1, 1)])
    pre_segments = [
        [(1, 1), (1, 6)],
        [(2, 1), (2, 3)],
        [(2, 3), (2, 5)],
        [(3, 1), (3, 3)],
        [(3, 3), (3, 5)],
        [(4, 1), (4, 5)],
        [(5, 1), (5, 3)],
        [(5, 3), (5, 6)],
        [(1, 5), (5, 5)],
        [(1, 3), (4, 3)],
        [(1, 1), (4, 1)],
        [(4, 1), (6, 1)],
        [(1, 2), (2, 2)],
        [(2, 2), (3, 2)],
        [(3, 2), (4, 2)],
        [(4, 2), (5, 2)],
        [(4, 3), (5, 3)],
        [(1, 4), (2, 4)],
        [(2, 4), (3, 4)],
        [(3, 4), (4, 4)],
        [(4, 4), (5, 4)],
    ]

    # ソート処理（x座標→y座標の昇順）
    sorted_segments = sorted(pre_segments, key=lambda seg: (seg[0][0], seg[0][1], seg[1][0], seg[1][1]))

    chk_point = []
    segments = []
    # 交差する点を算出
    for seg1 in sorted_segments:
        line1 = LineString(seg1)
        start, end = line1.coords
       
        div_point = [start]
        for seg2 in sorted_segments:
            line2 = LineString(seg2)
            
            if seg1 == seg2:
                continue
            
            if chk_lines(line1, line2) == "1点のみ接する":
                intersection = line1.intersection(line2)
                add = (intersection.x, intersection.y)
                if add not in div_point:
                    div_point.append(add)       
                
        
        div_point.append(end)

        print(div_point)

        # 点で分割
        sorted_div_point = sorted(div_point, key=lambda point: (point[0], point[1]))
        for i in range(len(sorted_div_point) - 1):
            item = sorted_div_point[i]
            next = sorted_div_point[i + 1]
            new_segments = [item, next]
           
            point_type = -1
            if poly.touches(LineString(new_segments)):
                 # 多角形内の境界線上
                 point_type = 0

            elif poly.covers(LineString(new_segments)):
                # 多角形内
                point_type = 1

            
            if point_type >= 0:
                segments.append(new_segments)
                
                if item not in chk_point:
                    chk_point.append([point_type, item])
                if next not in chk_point:
                    chk_point.append([point_type, next])
        
    chk_point = sorted(chk_point, key=lambda point: (point[0], point[1]))

    # 左下の点からチェック（右上の点はチェック不要）
    for cp in chk_point[:-1]:
        segs = np.array([seg for seg in segments if seg[0][0] == cp[1][0] and seg[0][1] == cp[1][1]])
        if cp[0] == 1:
            # 多角形内の境界線上
            # TODO 途中
            pass

        # 各点間の距離
        distances = np.linalg.norm(segs[:, 1, :] - segs[:, 0, :], axis=1)
        # 距離をチェック
        result = distances > 10
        if result.all():
            return False

    return True


def chk_distance2():

    print("---------------------chk_distance2-----------------")
    
    poly = Polygon([(2, 3), (5, 0), (9, 4), (5, 8), (3, 6), (5, 4), (4, 3), (3, 4), (2, 3)])
    data = [
        [2, Decimal(2.0), Decimal(5.0), Decimal(3500.0), Decimal(3.0), Decimal(6.0), Decimal(3500.0), 0],
        [2, Decimal(3.0), Decimal(6.0), Decimal(3500.0), Decimal(4.0), Decimal(7.0), Decimal(3500.0), 0],
        [2, Decimal(4.0), Decimal(7.0), Decimal(3500.0), Decimal(6.0), Decimal(9.0), Decimal(3500.0), 0],
        [2, Decimal(2.0), Decimal(3.0), Decimal(3500.0), Decimal(3.5), Decimal(4.5), Decimal(3500.0), 0],
        [2, Decimal(3.5), Decimal(4.5), Decimal(3500.0), Decimal(6.0), Decimal(7.0), Decimal(3500.0), 0],
        [2, Decimal(3.0), Decimal(2.0), Decimal(3500.0), Decimal(7.0), Decimal(6.0), Decimal(3500.0), 0],
        [2, Decimal(4.0), Decimal(1.0), Decimal(3500.0), Decimal(8.0), Decimal(5.0), Decimal(3500.0), 0],
        [2, Decimal(5.0), Decimal(0.0), Decimal(3500.0), Decimal(9.0), Decimal(4.0), Decimal(3500.0), 0],
        [2, Decimal(2.0), Decimal(3.0), Decimal(3500.0), Decimal(5.0), Decimal(0.0), Decimal(3500.0), 0],
        [2, Decimal(5.0), Decimal(8.0), Decimal(3500.0), Decimal(9.0), Decimal(4.0), Decimal(3500.0), 0],
        [2, Decimal(3.0), Decimal(6.0), Decimal(3500.0), Decimal(4.0), Decimal(5.0), Decimal(3500.0), 0],
        [2, Decimal(4.0), Decimal(7.0), Decimal(3500.0), Decimal(5.0), Decimal(6.0), Decimal(3500.0), 0],
        [2, Decimal(3.0), Decimal(4.0), Decimal(3500.0), Decimal(4.0), Decimal(3.0), Decimal(3500.0), 0],
        [2, Decimal(4.0), Decimal(5.0), Decimal(3500.0), Decimal(5.0), Decimal(4.0), Decimal(3500.0), 0],
        [2, Decimal(5.0), Decimal(6.0), Decimal(3500.0), Decimal(6.0), Decimal(5.0), Decimal(3500.0), 0],
        [2, Decimal(4.0), Decimal(3.0), Decimal(3500.0), Decimal(5.0), Decimal(2.0), Decimal(3500.0), 0],
        [2, Decimal(5.0), Decimal(4.0), Decimal(3500.0), Decimal(6.0), Decimal(3.0), Decimal(3500.0), 0],
        [2, Decimal(6.0), Decimal(5.0), Decimal(3500.0), Decimal(7.0), Decimal(4.0), Decimal(3500.0), 0],
        [2, Decimal(5.0), Decimal(2.0), Decimal(3500.0), Decimal(6.0), Decimal(1.0), Decimal(3500.0), 0],
        [2, Decimal(6.0), Decimal(3.0), Decimal(3500.0), Decimal(7.0), Decimal(2.0), Decimal(3500.0), 0],
        [2, Decimal(7.0), Decimal(4.0), Decimal(3500.0), Decimal(8.0), Decimal(3.0), Decimal(3500.0), 0]
    ]
    """
    poly = Polygon([(1, 1), (5, 1), (5, 3), (3, 3), (3, 5), (1, 5), (1, 1)])
    data = [
        [2, Decimal(1.0), Decimal(1.0), Decimal(3500.0), Decimal(1.0), Decimal(5.0), Decimal(3500.0), 0],
        [2, Decimal(3.0), Decimal(5.0), Decimal(3500.0), Decimal(1.0), Decimal(5.0), Decimal(3500.0), 0],
        [2, Decimal(3.0), Decimal(5.0), Decimal(3500.0), Decimal(3.0), Decimal(3.0), Decimal(3500.0), 0],
        [2, Decimal(1.0), Decimal(3.0), Decimal(3500.0), Decimal(5.0), Decimal(3.0), Decimal(3500.0), 0],
        [2, Decimal(1.0), Decimal(1.0), Decimal(3500.0), Decimal(5.0), Decimal(1.0), Decimal(3500.0), 0],
        [2, Decimal(5.0), Decimal(3.0), Decimal(3500.0), Decimal(5.0), Decimal(1.0), Decimal(3500.0), 0],
        [2, Decimal(1.0), Decimal(4.0), Decimal(3500.0), Decimal(2.0), Decimal(4.0), Decimal(3500.0), 0],
        [2, Decimal(2.0), Decimal(3.0), Decimal(3500.0), Decimal(2.0), Decimal(5.0), Decimal(3500.0), 0],
        [2, Decimal(2.5), Decimal(2.0), Decimal(3500.0), Decimal(2.5), Decimal(3.0), Decimal(3500.0), 0],
        [2, Decimal(1.0), Decimal(2.0), Decimal(3500.0), Decimal(5.0), Decimal(2.0), Decimal(3500.0), 0],
        [2, Decimal(4.0), Decimal(1.0), Decimal(3500.0), Decimal(4.0), Decimal(2.0), Decimal(3500.0), 0]
    ]
    """

    np_data = np.array(data)

    # 末尾に0の列を追加
    np_data = np.column_stack((np_data, np.zeros(np_data.shape[0], dtype=int)))

    # ソート
    sorted_indices = np.lexsort((np_data[:, 0], np_data[:, 1], np_data[:, 2], np_data[:, 4], np_data[:, 5]))
    sorted_data = np_data[sorted_indices]

    segments = []
    chk_point = []

    # 同一線上を結合する
    union_data = []
    for i in range(len(sorted_data)):
        seg1 = sorted_data[i]
        print("seg1:",seg1)

        if seg1[-1] == 1:
            continue

        line_t = LineString([(float(seg1[1]), float(seg1[2])), (float(seg1[4]), float(seg1[5]))])
        union_data.append(line_t)

        print(line_t)

        for j in range(i + 1, len(sorted_data)):
            seg2 = sorted_data[j]
            
            if seg2[-1] == 1:
                continue

            line_u = LineString([(float(seg2[1]), float(seg2[2])), (float(seg2[4]), float(seg2[5]))])

            if chk_lines(line_t, line_u) == "同一線上 & 線が重ならない":
                # 結合
                # linemergeを使って2つのLineStringを結合
                merged_line = linemerge([line_t, line_u])
                combined_line = LineString([merged_line.coords[0], merged_line.coords[-1]])
                seg1[-1] = 1
                seg2[-1] = 1

                union_data.remove(line_t)
                union_data.append(combined_line)
                line_t = combined_line

    print("union_data:",union_data)

    # 交差点で分割
    for line in union_data:
        l_start, l_end = line.coords

        div_point = [l_start]
        for div_line in union_data:

            if line == div_line:
                continue

            d_start, d_end = div_line.coords

            # 交点を算出
            intersection = line.intersection(div_line)

            # 交点が存在する場合
            add_flg = False
            if not intersection.is_empty:
                cross = (intersection.x, intersection.y)

                not_cross = d_end
                
                if poly.touches(Point(cross)):
                    # 交点が多角形と接する場合
                    add_flg = True
                elif cross == d_start:
                    # 交点が始点と一致
                    not_cross = d_end
                elif cross == d_end:
                    # 交点が終点と一致
                    not_cross = d_start
                else:
                    # 交差する場合
                    add_flg = True

                if l_start[0] == l_end[0]:
                    # 縦線
                    if cross[0] < not_cross[0]:
                        add_flg = True

                elif l_start[1] == l_end[1]:
                    # 横線
                    if cross[1] < not_cross[1]:
                        add_flg = True

                else:
                    # 斜め
                    slope = (Decimal(l_end[1]) - Decimal(l_start[1])) / (Decimal(l_end[0]) - Decimal(l_start[0]))

                    if slope > 0:
                        # 右上がり
                        if cross[0] < not_cross[0] and cross[1] > not_cross[1]:
                            add_flg = True
                    else:
                        # 左上がり
                        if cross[0] < not_cross[0] and cross[1] < not_cross[1]:
                            add_flg = True

                if add_flg:
                    if cross not in div_point:
                        div_point.append(cross) 
                
        if l_end not in div_point:
            div_point.append(l_end)

        # 点で分割
        sorted_div_point = sorted(div_point, key=lambda point: (point[0], point[1]))

        print("sorted_div_point:",sorted_div_point)

        for i in range(len(sorted_div_point) - 1):
            item = sorted_div_point[i]
            next = sorted_div_point[i + 1]
            new_segments = [item, next]
           
            if poly.covers(LineString(new_segments)):
                # 多角形内
                segments.append(new_segments)

                if item not in chk_point:
                    chk_point.append(item)
                #if next not in chk_point:
                #    chk_point.append(next)

                if i == len(sorted_div_point) - 2:
                    segments.append([next, next])
            else:
                if i != 0:
                    segments.append([item, item])


    print('------segments-----')
    print("")
    print(segments)

    print('------chk_point-----')
    print("")
    print(chk_point)

    # 左下の点からチェック
    chk_point = sorted(chk_point, key=lambda point: (point[0], point[1]))
    for cp in chk_point:
        segs = np.array([seg for seg in segments if seg[0] == cp])
        print("cp:",cp)
        print("segs:",segs)

        if len(segs) != 2:
            return False
        
        # 各点間の距離
        distances = np.sort(np.linalg.norm(segs[:, 1, :] - segs[:, 0, :], axis=1))
        print("distances:",distances)
        # 距離をチェック
        # TODO 条件
        if True:
            # 両方向のチェック
            result = (distances > 10).all()
            if result:
                return False
        else:
            # 片方のチェック
            if distances[0] > 10:
                return False
    
    return True



line31 = LineString([(0, 0), (4, 4)])
line32 = LineString([(0, 4), (4, 0)])
print("交差 [(0, 0), (4, 4)]、[(0, 4), (4, 0)] :", chk_lines(line31, line32))

line35 = LineString([(1, 1), (5, 1)])
line36 = LineString([(3, 1), (7, 1)])
print("重なる線分 [(1, 1), (5, 1)]、[(3, 1), (7, 1)] :", chk_lines(line35, line36))
