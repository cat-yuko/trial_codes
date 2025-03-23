# ブロードキャストを活用できない場合のソート
def try_sort():
    print('------try_sort-----')

    data = [
        [1, Decimal(910.0), Decimal(910.0), Decimal(555.0), Decimal(910.0), Decimal(1820.0), Decimal(555.0), 0],
        [1, Decimal(1820.0), Decimal(910.0), Decimal(555.0), Decimal(910.0), Decimal(3640.0), Decimal(555.0), 0],
        [1, Decimal(910.0), Decimal(910.0), Decimal(555.0), Decimal(1820.0), Decimal(910.0), Decimal(555.0), 0],
        [2, Decimal(910.0), Decimal(910.0), Decimal(555.0), Decimal(910.0), Decimal(3640.0), Decimal(555.0), 0],
        [2, Decimal(910.0), Decimal(910.0), Decimal(555.0), Decimal(1820.0), Decimal(910.0), Decimal(555.0), 0],
        [2, Decimal(1820.0), Decimal(910.0), Decimal(555.0), Decimal(4550.0), Decimal(910.0), Decimal(555.0), 0]
    ]

    np_data = np.array(data)

    print('')
    print('np_data:',np_data)

    # ソートしてから更新する場合 --------------------------------
    # まず2列目（インデックス1）でソートし、次に1列目（インデックス0）でソート
    sorted_indices = np.lexsort((np_data[:, 0], np_data[:, 1], np_data[:, 2], np_data[:, 4], np_data[:, 5]))
    sorted_data = np_data[sorted_indices]

    print('sorted:',sorted_data)

    for i in range(sorted_data.shape[0]):
        # 1列目の値が2の場合
        if np_data[i, 0] == 2:
            # 最終列に1をセット
            np_data[i, -1] = 1
    
    print('np_data:',np_data)


    # 条件を絞ってから更新する場合 --------------------------------
    np_data_2 = np.array(data)
    # 条件を満たす行のインデックスを取得
    # 1列目（インデックス0）が2の行
    indices = np.where(np_data_2[:, 0] == 2)[0]

    print('')
    print('indices:',indices)

    # for文で更新
    for i in indices:
        # 最終列に2をセット
        np_data_2[i, -1] = 2
    
    print('')
    print('np_data_2:',np_data_2)

    # 条件を絞る -> ソートしてから更新する場合 --------------------------------
    np_data_3 = np.array(data)
    # 1列目（インデックス0）が2の行
    indices = np.where(np_data_3[:, 0] == 2)[0]

    # ソート
    sorted_indices = indices[np.lexsort((np_data[indices, 0], np_data[indices, 1], np_data[indices, 2], np_data[indices, 4], np_data[indices, 4]))]

    print('')
    print('indices:',indices) 

    # for文で更新
    for i in sorted_indices:
        np_data_3[i, -1] = 3

    print('')
    print('np_data_3:',np_data_3)

    # ブロードキャストを利用する場合
    np_data_3[sorted_indices, -1] = 3
    
