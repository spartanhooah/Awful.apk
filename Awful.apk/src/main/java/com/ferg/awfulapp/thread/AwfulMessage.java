/********************************************************************************
 * Copyright (c) 2012, Matthew Shepard
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of the software nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY SCOTT FERGUSON ''AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL SCOTT FERGUSON BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *******************************************************************************/

package com.ferg.awfulapp.thread;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;

import com.ferg.awfulapp.R;
import com.ferg.awfulapp.constants.Constants;
import com.ferg.awfulapp.preferences.AwfulPreferences;
import com.ferg.awfulapp.provider.ColorProvider;
import com.ferg.awfulapp.util.AwfulError;

import org.apache.commons.lang3.StringEscapeUtils;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.util.ArrayList;
/**
 * SA Private Messages.
 * @author Geekner
 */
public class AwfulMessage extends AwfulPagedItem {

	private static final String TAG = "AwfulMessage";

	public static final String PATH     = "/privatemessages";
	public static final Uri CONTENT_URI = Uri.parse("content://" + Constants.AUTHORITY + PATH);
	public static final String PATH_REPLY     = "/draftreplies";
	public static final Uri CONTENT_URI_REPLY = Uri.parse("content://" + Constants.AUTHORITY + PATH_REPLY);
	public static final String PATH_THREAD     = "/draftthreads";
	public static final Uri CONTENT_URI_THREAD = Uri.parse("content://" + Constants.AUTHORITY + PATH_THREAD);

	public static final String ID = "_id";
	public static final String TITLE 		="title";
	public static final String AUTHOR 		="author";
	public static final String CONTENT 	="content";
	public static final String DATE 	="message_date";
	public static final String EPOC_TIMESTAMP = "epoc_timestamp";
	public static final String TYPE = "message_type";
	public static final String ICON = "icon";
	public static final String UNREAD = "unread_message";
	public static final String RECIPIENT = "recipient";
	public static final String REPLY_CONTENT = "reply_content";
	public static final String REPLY_ICON = "reply_icon";
	public static final String REPLY_TITLE = "reply_title";
	public static final String REPLY_ATTACHMENT = "attachment";
	public static final String REPLY_SIGNATURE = "signature";
	public static final String REPLY_DISABLE_SMILIES = "disablesmilies";

	public static final String POST_CONTENT = "post_content";
	public static final String POST_SUBJECT = "post_subject";
	public static final String POST_ICON_ID = "post_icon_id";
	public static final String POST_ICON_URL = "post_icon_url";
	public static final String FOLDER = "folder";

	public static final int TYPE_PM = 1;
	public static final int TYPE_NEW_REPLY = 2;
	public static final int TYPE_QUOTE = 3;
	public static final int TYPE_EDIT = 4;

	/**
	 * Generates List view items for PM list.
	 */
	public static View getView(View current, AwfulPreferences aPref, Cursor data, boolean selected) {
		TextView title = (TextView) current.findViewById(R.id.title);
		String t = data.getString(data.getColumnIndex(TITLE));
		current.findViewById(R.id.unread_count).setVisibility(View.GONE);
		if(t != null){
			title.setText(t);
			title.setTextColor(ColorProvider.PRIMARY_TEXT.getColor());
		}
		TextView author = (TextView) current.findViewById(R.id.thread_info);
		String auth = data.getString(data.getColumnIndex(AUTHOR));
		String date = data.getString(data.getColumnIndex(DATE));
		if(auth != null && date != null){
			author.setText(auth +" - "+date);
			author.setTextColor(ColorProvider.ALT_TEXT.getColor());
		}

		ImageView unreadPM = (ImageView) current.findViewById(R.id.thread_tag);
		ImageView overlay = (ImageView) current.findViewById(R.id.thread_tag_overlay);
		overlay.setVisibility(View.GONE);

		unreadPM.setVisibility(View.VISIBLE);
		int iconResource;
		switch (data.getInt(data.getColumnIndex(UNREAD))){
			default:
			case 0:
				//unread
				iconResource = R.drawable.ic_drafts_dark;
				break;
			case 1:
				//read
				iconResource = R.drawable.ic_mail_dark;
				break;
			case 2:
				//replied
				iconResource = R.drawable.ic_reply_dark;
				break;
		}
		String icon = data.getString(data.getColumnIndex(ICON));
		if(icon != null && !icon.isEmpty()){
			String localFileName = "@drawable/"+icon.substring(icon.lastIndexOf('/') + 1,icon.lastIndexOf('.')).replace('-','_').toLowerCase();
			int imageID = current.getResources().getIdentifier(localFileName, null, current.getContext().getPackageName());
			if(imageID == 0){
				unreadPM.setImageResource(iconResource);
			}else{
				unreadPM.setImageResource(imageID);
				overlay.setImageResource(iconResource);
				overlay.setBackgroundResource(R.drawable.overlay_background);
				overlay.setVisibility(View.VISIBLE);
			}
		}else{
			unreadPM.setImageResource(iconResource);
		}
		return current;
	}

	public static void processMessageList(ContentResolver contentInterface, Document data, int folder) throws AwfulError {
		ArrayList<ContentValues> msgList = new ArrayList<ContentValues>();

		/**METHOD One: Parse PM links. Easy, but only contains id+title.**/
		/*TagNode[] messagesParent = data.getElementsByAttValue("name", "form", true, true);
		if(messagesParent.length > 0){
			TagNode[] messages = messagesParent[0].getElementsByName("a", true);
			for(TagNode msg : messages){
				String href = msg.getAttributeByName("href");
				if(href != null){
					AwfulMessage pm = new AwfulMessage(Integer.parseInt(href.replaceAll("\\D", "")));
					pm.mTitle = msg.getText().toString();
					pm.mAuthor = "";
					msgList.add(pm);
				}
			}
		}else{
			Log.e("AwfulMessage","Failed to parse message parent");
			return null;//we'll use this to show that the load failed. i am still lazy.
		}*/

		/**METHOD Two: Parse table structure, hard and quick to break.**/
		Elements messagesParent = data.getElementsByAttributeValue("name", "form");
		if(messagesParent.size() > 0){
			Elements messages = messagesParent.first().getElementsByTag("tr");
			for(Element msg : messages){
				if(msg == messages.get(0)){
					continue;
				}
				ContentValues pm = new ContentValues();
				//fuck i hate scraping shit.
				//no usable identifiers on the PM list, no easy method to find author/post date.
				//this will break if they change the display structure.
				Elements row = msg.getElementsByTag("td");
				if(row != null && row.size() > 4){
					//TODO abandon hope, all ye who enter
					//row[0] - icon, newpm.gif - sublevel
					//row[1] - post icon TODO if we ever add icon support - sublevel
					//row[2] - pm subject/link - sublevel
					//row[3] - sender
					//row[4] - date
					Element href = row.get(2).getElementsByTag("a").first();
					pm.put(ID, Integer.parseInt(href.attr("href").replaceAll("\\D", "")));
					pm.put(TITLE, href.text());
					Element icon = row.get(1).getElementsByTag("img").first();
					if(icon == null){
						pm.put(ICON, "");
					}else{
						pm.put(ICON, icon.attr("src"));
					}
					pm.put(AUTHOR, row.get(3).text());
					pm.put(DATE, row.get(4).text());
					pm.put(CONTENT, " ");
					if(row.first().getElementsByTag("img").first().attr("src").endsWith("newpm.gif")){
						pm.put(UNREAD, 1);
					}else if(row.first().getElementsByTag("img").first().attr("src").endsWith("pmreplied.gif")){
						pm.put(UNREAD, 2);
					}else{
						pm.put(UNREAD, 0);
					}
					pm.put(FOLDER, folder);
					msgList.add(pm);
				}
			}
		}else{
			throw new AwfulError("Failed to parse message parent");
		}
		contentInterface.bulkInsert(CONTENT_URI, msgList.toArray(new ContentValues[msgList.size()]));
	}

	public static ContentValues processMessage(Document data, int id) throws AwfulError{
		ContentValues message = new ContentValues();
		message.put(ID, id);
		Elements auth = data.getElementsByClass("author");
		if(auth.size() > 0){
			message.put(AUTHOR, auth.first().text());
		}else{
			throw new AwfulError("Failed parse: author.");
		}
		Elements content = data.getElementsByClass("postbody");
		if(content.size() > 0){
			message.put(CONTENT, content.first().html());
		}else{
			throw new AwfulError("Failed parse: content.");
		}
		Elements date = data.getElementsByClass("postdate");
		if(date.size() > 0){
			message.put(DATE, date.first().text().replaceAll("\"", "").trim());
		}else{
			throw new AwfulError("Failed parse: date.");
		}
		return message;
	}

	public static ContentValues processReplyMessage(Document pmReplyData, int id) {
		ContentValues reply = new ContentValues();
		reply.put(ID, id);
		reply.put(TYPE, TYPE_PM);
		Elements message = pmReplyData.getElementsByAttributeValue("name", "message");
		if(message.size() >0){
			String quoteText = StringEscapeUtils.unescapeHtml4(message.first().text().replaceAll("[\\r\\f]", ""));
			reply.put(REPLY_CONTENT, quoteText);
		}
		Elements title = pmReplyData.getElementsByAttributeValue("name", "title");
		if(title.size() >0){
			String quoteTitle = StringEscapeUtils.unescapeHtml4(title.first().attr("value"));
			reply.put(TITLE, quoteTitle);
		}
		Elements recipient = pmReplyData.getElementsByAttributeValue("name", "touser");
		if(title.size() >0){
			String recip = StringEscapeUtils.unescapeHtml4(recipient.first().attr("value"));
			reply.put(RECIPIENT, recip);
		}
		return reply;
	}


	public static String getMessageHtml(String content){
		return String.format("<article class='post'><section class='postcontent'>%s</section></article>", content == null ? "" : content);
	}
}
