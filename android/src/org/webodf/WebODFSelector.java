package org.webodf;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FilenameFilter;
import java.io.IOException;

import android.app.ListActivity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.widget.AdapterView;
import android.widget.AdapterView.OnItemClickListener;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.TextView;

public class WebODFSelector extends ListActivity {

	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		updateList();
		ListView lv = getListView();
		lv.setTextFilterEnabled(true);

		lv.setOnItemClickListener(new OnItemClickListener() {
			public void onItemClick(AdapterView<?> parent, View view,
					int position, long id) {
				String filename = ((TextView) view).getText().toString();
				File f = new File(mPath, filename);
				if (f.isDirectory()) {
					mPath = f;
					updateList();
					return;
				}
				Intent intent = new Intent(Intent.ACTION_VIEW);
				intent.setDataAndType(Uri.fromFile(f),
						"application/vnd.oasis.opendocument.text");
				startActivity(intent);
			}
		});
/* code to immediatly open document which is handy when debugging
		Intent intent = new Intent(Intent.ACTION_VIEW);
		intent.setDataAndType(Uri.fromFile(new File(new File(mPath, "download"), "DanskTest08.odt")),
				"application/vnd.oasis.opendocument.text");
		startActivity(intent);
*/
	}

	private void updateList() {
		setListAdapter(new ArrayAdapter<String>(this, R.layout.listitem,
				loadFileList()));
	}

	final private File mRoot = Environment.getExternalStorageDirectory();
	private File mPath = mRoot;

	final private String odfmime = "mimetypeapplication/vnd.oasis.opendocument.";

	private boolean seemsODFFile(File file) {
		if (!file.canRead() || file.length() < 100) {
			return false;
		}
		boolean valid = false;
		try {
			FileInputStream input = new FileInputStream(file);
			byte[] buffer = new byte[96];
			if (input.read(buffer) == buffer.length) {
				String mime = new String(buffer, 30, odfmime.length(),
						"US-ASCII");
				valid = mime.equals(odfmime);
			}
			input.close();
		} catch (FileNotFoundException e) {
		} catch (IOException e) {
		}
		return valid;
	}

	private String[] loadFileList() {
		if (mPath.exists()) {
			FilenameFilter filter = new FilenameFilter() {
				public boolean accept(File dir, String filename) {
					File sel = new File(dir, filename);
					return sel.isDirectory() || seemsODFFile(sel);
				}
			};
			String[] list = mPath.list(filter);
			if (mPath.equals(mRoot)) {
				return list;
			}
			String[] newlist = new String[list.length + 1];
			newlist[0] = "..";
			for (int i = 0; i < list.length; ++i) {
				newlist[i + 1] = list[i];
			}
			return newlist;
		} else {
			return new String[0];
		}
	}
}
